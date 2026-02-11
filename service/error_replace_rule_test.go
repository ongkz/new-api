package service

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

func TestBuildErrorMatchText_StatusCodeAndRootError(t *testing.T) {
	upstreamErr := errors.New("unexpected end of JSON input")
	wrapped := fmt.Errorf("unmarshal response body failed: %w", upstreamErr)

	newAPIError := types.NewErrorWithStatusCode(wrapped, types.ErrorCodeBadResponseBody, 500)
	matchText := BuildErrorMatchText(newAPIError)

	if !containsAll(matchText, []string{
		"status_code=500",
		"unexpected end of JSON input",
		"status_code=500, unexpected end of JSON input",
	}) {
		t.Fatalf("matchText missing expected substrings, got: %q", matchText)
	}
}

func TestFindFirstMatchedErrorReplaceRule_Examples(t *testing.T) {
	rules := []*model.ErrorReplaceRule{
		{
			Id:                 1,
			Name:               "容量不足",
			Enabled:            true,
			MatchType:          model.ErrorReplaceMatchTypeStatusCodeAndContent,
			StatusCode:         500,
			Pattern:            "MODEL_CAPACITY_EXHAUSTED",
			ReplacementMessage: "429了老铁",
			Priority:           10,
		},
		{
			Id:                 2,
			Name:               "预算参数友好提示",
			Enabled:            true,
			MatchType:          model.ErrorReplaceMatchTypeStatusCodeAndContent,
			StatusCode:         400,
			Pattern:            "thinking.budget_tokens",
			ReplacementMessage: "思考预算参数错误，请检查 thinking.budget_tokens",
			Priority:           10,
		},
		{
			Id:                 3,
			Name:               "参数错误",
			Enabled:            true,
			MatchType:          model.ErrorReplaceMatchTypeContent,
			Pattern:            "status_code=500, unexpected end of JSON input",
			ReplacementMessage: "参数错误 请查看官方参数",
			Priority:           5,
		},
	}

	// 500 + MODEL_CAPACITY_EXHAUSTED -> 429了老铁
	rule := FindFirstMatchedErrorReplaceRule(rules, 500, "status_code=500, MODEL_CAPACITY_EXHAUSTED")
	if rule == nil || rule.ReplacementMessage != "429了老铁" {
		t.Fatalf("expected rule 1, got %#v", rule)
	}

	// 400 + thinking.budget_tokens -> friendly
	rule = FindFirstMatchedErrorReplaceRule(rules, 400, "status_code=400, invalid param thinking.budget_tokens")
	if rule == nil || rule.Id != 2 {
		t.Fatalf("expected rule 2, got %#v", rule)
	}

	// 500 + JSON parse fail -> 参数错误 请查看官方参数
	rule = FindFirstMatchedErrorReplaceRule(rules, 500, "status_code=500, unexpected end of JSON input")
	if rule == nil || rule.Id != 3 {
		t.Fatalf("expected rule 3, got %#v", rule)
	}
}

func TestApplyErrorReplaceRules_UsesCachedRulesAndSetsPublicMessage(t *testing.T) {
	InvalidateErrorReplaceRuleCache()
	t.Cleanup(InvalidateErrorReplaceRuleCache)

	rules := []*model.ErrorReplaceRule{
		{
			Id:                 1,
			Name:               "容量不足",
			Enabled:            true,
			MatchType:          model.ErrorReplaceMatchTypeContent,
			Pattern:            "MODEL_CAPACITY_EXHAUSTED",
			ReplacementMessage: "429了老铁",
			Priority:           10,
		},
	}
	errorReplaceRuleCacheVal.Store(&errorReplaceRuleCache{loadedAt: time.Now(), rules: rules})

	newAPIError := types.NewErrorWithStatusCode(errors.New("MODEL_CAPACITY_EXHAUSTED"), types.ErrorCodeBadResponseStatusCode, 500)
	rule, applied := ApplyErrorReplaceRules(nil, newAPIError)
	if !applied || rule == nil || rule.Id != 1 {
		t.Fatalf("expected rule applied, got applied=%v rule=%#v", applied, rule)
	}
	if newAPIError.Error() != "429了老铁" {
		t.Fatalf("expected public message replaced, got: %q", newAPIError.Error())
	}
}

func TestApplyErrorReplaceRules_NoMatchDoesNotChangeMessage(t *testing.T) {
	InvalidateErrorReplaceRuleCache()
	t.Cleanup(InvalidateErrorReplaceRuleCache)

	rules := []*model.ErrorReplaceRule{
		{
			Id:                 1,
			Name:               "容量不足",
			Enabled:            true,
			MatchType:          model.ErrorReplaceMatchTypeContent,
			Pattern:            "MODEL_CAPACITY_EXHAUSTED",
			ReplacementMessage: "429了老铁",
			Priority:           10,
		},
	}
	errorReplaceRuleCacheVal.Store(&errorReplaceRuleCache{loadedAt: time.Now(), rules: rules})

	newAPIError := types.NewErrorWithStatusCode(errors.New("some other error"), types.ErrorCodeBadResponseStatusCode, 500)
	_, applied := ApplyErrorReplaceRules(nil, newAPIError)
	if applied {
		t.Fatalf("expected rule not applied")
	}
	if newAPIError.Error() != "some other error" {
		t.Fatalf("expected message unchanged, got: %q", newAPIError.Error())
	}
}

func containsAll(text string, subs []string) bool {
	for _, s := range subs {
		if s == "" {
			continue
		}
		if !stringsContains(text, s) {
			return false
		}
	}
	return true
}

func stringsContains(haystack string, needle string) bool {
	// Inline to avoid importing strings in many tests; keeps messages stable.
	return len(needle) == 0 || (len(haystack) >= len(needle) && indexOf(haystack, needle) >= 0)
}

func indexOf(s, substr string) int {
	// Simple substring search; sufficient for tests.
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
