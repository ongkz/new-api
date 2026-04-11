package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type errorReplaceRuleCache struct {
	loadedAt time.Time
	rules    []*model.ErrorReplaceRule
}

var errorReplaceRuleCacheMu sync.Mutex
var errorReplaceRuleCacheVal atomic.Value // *errorReplaceRuleCache

const errorReplaceRuleCacheTTL = 10 * time.Second

func InvalidateErrorReplaceRuleCache() {
	errorReplaceRuleCacheVal.Store((*errorReplaceRuleCache)(nil))
}

func getEnabledErrorReplaceRulesCached() ([]*model.ErrorReplaceRule, error) {
	if v := errorReplaceRuleCacheVal.Load(); v != nil {
		if cache, ok := v.(*errorReplaceRuleCache); ok && cache != nil {
			if time.Since(cache.loadedAt) < errorReplaceRuleCacheTTL {
				return cache.rules, nil
			}
		}
	}

	errorReplaceRuleCacheMu.Lock()
	defer errorReplaceRuleCacheMu.Unlock()

	if v := errorReplaceRuleCacheVal.Load(); v != nil {
		if cache, ok := v.(*errorReplaceRuleCache); ok && cache != nil {
			if time.Since(cache.loadedAt) < errorReplaceRuleCacheTTL {
				return cache.rules, nil
			}
		}
	}

	rules, err := model.GetEnabledErrorReplaceRules(true)
	if err != nil {
		return nil, err
	}
	cache := &errorReplaceRuleCache{
		loadedAt: time.Now(),
		rules:    rules,
	}
	errorReplaceRuleCacheVal.Store(cache)
	return rules, nil
}

func rootErrorString(err error) string {
	if err == nil {
		return ""
	}
	seen := make(map[error]struct{}, 4)
	cur := err
	for cur != nil {
		if _, ok := seen[cur]; ok {
			break
		}
		seen[cur] = struct{}{}
		next := errors.Unwrap(cur)
		if next == nil {
			break
		}
		cur = next
	}
	if cur == nil {
		return ""
	}
	return cur.Error()
}

func BuildErrorMatchText(newAPIError *types.NewAPIError) string {
	if newAPIError == nil {
		return ""
	}

	statusCode := newAPIError.StatusCode
	var b strings.Builder
	b.Grow(256)

	b.WriteString(newAPIError.ErrorWithStatusCode())
	b.WriteString("\n")

	if rootMsg := rootErrorString(newAPIError.Err); rootMsg != "" && rootMsg != newAPIError.Error() {
		b.WriteString(fmt.Sprintf("status_code=%d, %s\n", statusCode, rootMsg))
	}
	if strings.TrimSpace(newAPIError.UpstreamParseError) != "" {
		b.WriteString(fmt.Sprintf("status_code=%d, %s\n", statusCode, strings.TrimSpace(newAPIError.UpstreamParseError)))
	}
	if strings.TrimSpace(newAPIError.UpstreamBody) != "" {
		b.WriteString(newAPIError.UpstreamBody)
		b.WriteString("\n")
	}

	switch relayErr := newAPIError.RelayError.(type) {
	case types.OpenAIError:
		if relayErr.Message != "" {
			b.WriteString(relayErr.Message)
			b.WriteString("\n")
		}
		if relayErr.Type != "" {
			b.WriteString(relayErr.Type)
			b.WriteString("\n")
		}
		if relayErr.Param != "" {
			b.WriteString(relayErr.Param)
			b.WriteString("\n")
		}
		if relayErr.Code != nil {
			b.WriteString(fmt.Sprintf("%v\n", relayErr.Code))
		}
		if len(relayErr.Metadata) > 0 {
			b.WriteString(string(relayErr.Metadata))
			b.WriteString("\n")
		}
	case types.ClaudeError:
		if relayErr.Message != "" {
			b.WriteString(relayErr.Message)
			b.WriteString("\n")
		}
		if relayErr.Type != "" {
			b.WriteString(relayErr.Type)
			b.WriteString("\n")
		}
	}

	return b.String()
}

func isLikelyJSONParseError(text string) bool {
	lower := strings.ToLower(text)
	if strings.Contains(lower, "unexpected end of json input") {
		return true
	}
	if strings.Contains(lower, "unexpected eof") {
		return true
	}
	if strings.Contains(lower, "invalid character") && strings.Contains(lower, "looking for beginning of value") {
		return true
	}
	if strings.Contains(lower, "cannot unmarshal") && strings.Contains(lower, "json") {
		return true
	}
	return false
}

func ShouldHideUpstreamErrorDetails(newAPIError *types.NewAPIError) bool {
	if newAPIError == nil {
		return false
	}
	if strings.TrimSpace(newAPIError.UpstreamParseError) != "" {
		return true
	}
	if newAPIError.GetErrorCode() == types.ErrorCodeBadResponseBody && isLikelyJSONParseError(newAPIError.Error()) {
		return true
	}
	return false
}

func FindFirstMatchedErrorReplaceRule(rules []*model.ErrorReplaceRule, statusCode int, matchText string) *model.ErrorReplaceRule {
	if len(rules) == 0 {
		return nil
	}
	matchTextLower := strings.ToLower(matchText)
	for _, rule := range rules {
		if rule == nil || !rule.Enabled {
			continue
		}
		switch rule.MatchType {
		case model.ErrorReplaceMatchTypeContent:
			if rule.Pattern != "" && strings.Contains(matchTextLower, strings.ToLower(rule.Pattern)) {
				return rule
			}
		case model.ErrorReplaceMatchTypeStatusCode:
			if rule.StatusCode == statusCode {
				return rule
			}
		case model.ErrorReplaceMatchTypeStatusCodeAndContent:
			if rule.StatusCode == statusCode && rule.Pattern != "" && strings.Contains(matchTextLower, strings.ToLower(rule.Pattern)) {
				return rule
			}
		}
	}
	return nil
}

// ApplyErrorReplaceRules applies the first matched rule (priority DESC, id ASC) to newAPIError.
// It returns the matched rule and whether it applied.
func ApplyErrorReplaceRules(c *gin.Context, newAPIError *types.NewAPIError) (*model.ErrorReplaceRule, bool) {
	if newAPIError == nil {
		return nil, false
	}
	rules, err := getEnabledErrorReplaceRulesCached()
	if err != nil {
		if c != nil {
			logger.LogError(c, fmt.Sprintf("load error replace rules failed: %v", err))
		}
		return nil, false
	}
	matchText := BuildErrorMatchText(newAPIError)
	rule := FindFirstMatchedErrorReplaceRule(rules, newAPIError.StatusCode, matchText)
	if rule == nil {
		return nil, false
	}
	newAPIError.SetPublicMessage(rule.ReplacementMessage)
	return rule, true
}
