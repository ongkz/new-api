package service

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

type dailyWelfareRuleCache struct {
	loadedAt     time.Time
	rulesByModel map[string][]*model.DailyWelfareRule
}

var dailyWelfareRuleCacheMu sync.Mutex
var dailyWelfareRuleCacheVal atomic.Value // *dailyWelfareRuleCache

const dailyWelfareRuleCacheTTL = 10 * time.Second

func InvalidateDailyWelfareRuleCache() {
	dailyWelfareRuleCacheVal.Store((*dailyWelfareRuleCache)(nil))
}

func getEnabledDailyWelfareRulesCached() (map[string][]*model.DailyWelfareRule, error) {
	if v := dailyWelfareRuleCacheVal.Load(); v != nil {
		if cache, ok := v.(*dailyWelfareRuleCache); ok && cache != nil {
			if time.Since(cache.loadedAt) < dailyWelfareRuleCacheTTL {
				return cache.rulesByModel, nil
			}
		}
	}

	dailyWelfareRuleCacheMu.Lock()
	defer dailyWelfareRuleCacheMu.Unlock()

	if v := dailyWelfareRuleCacheVal.Load(); v != nil {
		if cache, ok := v.(*dailyWelfareRuleCache); ok && cache != nil {
			if time.Since(cache.loadedAt) < dailyWelfareRuleCacheTTL {
				return cache.rulesByModel, nil
			}
		}
	}

	rules, err := model.GetEnabledDailyWelfareRules(true)
	if err != nil {
		return nil, err
	}
	rulesByModel := make(map[string][]*model.DailyWelfareRule, 64)
	for _, rule := range rules {
		if rule == nil {
			continue
		}
		rulesByModel[rule.Model] = append(rulesByModel[rule.Model], rule)
	}
	cache := &dailyWelfareRuleCache{
		loadedAt:     time.Now(),
		rulesByModel: rulesByModel,
	}
	dailyWelfareRuleCacheVal.Store(cache)
	return rulesByModel, nil
}

func minuteOfDay(t time.Time) int {
	return t.Hour()*60 + t.Minute()
}

func isInDailyWindow(nowMinute int, startMinute int, endMinute int) bool {
	if startMinute == endMinute {
		// Define as: all day
		return true
	}
	if startMinute < endMinute {
		return nowMinute >= startMinute && nowMinute < endMinute
	}
	// Cross-day window: 23:00-02:00
	return nowMinute >= startMinute || nowMinute < endMinute
}

func GetDailyWelfareRuleForModel(c *gin.Context, modelName string, now time.Time) (*model.DailyWelfareRule, bool) {
	modelName = ratio_setting.FormatMatchingModelName(modelName)
	rulesByModel, err := getEnabledDailyWelfareRulesCached()
	if err != nil {
		if c != nil {
			logger.LogError(c, fmt.Sprintf("load daily welfare rules failed: %v", err))
		}
		return nil, false
	}
	rules := rulesByModel[modelName]
	if len(rules) == 0 {
		return nil, false
	}
	nowMinute := minuteOfDay(now)
	for _, rule := range rules {
		if rule == nil || !rule.Enabled {
			continue
		}
		if isInDailyWindow(nowMinute, rule.StartMinute, rule.EndMinute) {
			return rule, true
		}
	}
	return nil, false
}
