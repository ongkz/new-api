package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

type DailyWelfareRuleRequest struct {
	Enabled     bool   `json:"enabled"`
	Model       string `json:"model"`
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	StartMinute *int   `json:"start_minute"`
	EndMinute   *int   `json:"end_minute"`

	// Base override:
	// - If model uses fixed price (ModelPrice), Value means "USD/次"
	// - Otherwise, Value means "输入倍率" (ModelRatio)
	Value float64 `json:"value"`

	// Optional overrides (ratio-based only). Nil means "use existing settings".
	CompletionRatio      *float64 `json:"completion_ratio"`
	CacheRatio           *float64 `json:"cache_ratio"`
	CreateCacheRatio     *float64 `json:"create_cache_ratio"`
	ImageRatio           *float64 `json:"image_ratio"`
	AudioRatio           *float64 `json:"audio_ratio"`
	AudioCompletionRatio *float64 `json:"audio_completion_ratio"`

	Priority int64 `json:"priority"`
}

func parseMinuteOfDay(value string) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, errors.New("empty time")
	}
	parts := strings.Split(value, ":")
	if len(parts) != 2 {
		return 0, errors.New("invalid time format")
	}
	hour, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil {
		return 0, errors.New("invalid hour")
	}
	minute, err := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil {
		return 0, errors.New("invalid minute")
	}
	if hour < 0 || hour > 23 || minute < 0 || minute > 59 {
		return 0, errors.New("invalid time")
	}
	return hour*60 + minute, nil
}

func ListDailyWelfareRules(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	rules, total, err := model.GetDailyWelfareRulePage(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(rules)
	common.ApiSuccess(c, pageInfo)
}

func CreateDailyWelfareRule(c *gin.Context) {
	var req DailyWelfareRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	startMinute := 0
	endMinute := 0
	var err error
	if req.StartMinute != nil {
		startMinute = *req.StartMinute
	} else {
		startMinute, err = parseMinuteOfDay(req.StartTime)
		if err != nil {
			common.ApiErrorMsg(c, "开始时间格式错误，应为 HH:mm")
			return
		}
	}
	if req.EndMinute != nil {
		endMinute = *req.EndMinute
	} else {
		endMinute, err = parseMinuteOfDay(req.EndTime)
		if err != nil {
			common.ApiErrorMsg(c, "结束时间格式错误，应为 HH:mm")
			return
		}
	}

	modelName := ratio_setting.FormatMatchingModelName(req.Model)
	if _, ok := ratio_setting.GetModelPrice(modelName, false); !ok && !ratio_setting.IsModelRatioConfigured(modelName) {
		common.ApiErrorMsg(c, "模型未配置价格或倍率，请先在「分组与模型定价设置」中配置")
		return
	}

	rule := &model.DailyWelfareRule{
		Enabled:              req.Enabled,
		Model:                modelName,
		StartMinute:          startMinute,
		EndMinute:            endMinute,
		Value:                req.Value,
		CompletionRatio:      req.CompletionRatio,
		CacheRatio:           req.CacheRatio,
		CreateCacheRatio:     req.CreateCacheRatio,
		ImageRatio:           req.ImageRatio,
		AudioRatio:           req.AudioRatio,
		AudioCompletionRatio: req.AudioCompletionRatio,
		Priority:             req.Priority,
	}
	if err := model.CreateDailyWelfareRule(rule); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidateDailyWelfareRuleCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建成功",
		"data":    rule,
	})
}

func UpdateDailyWelfareRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req DailyWelfareRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	startMinute := 0
	endMinute := 0
	if req.StartMinute != nil {
		startMinute = *req.StartMinute
	} else {
		startMinute, err = parseMinuteOfDay(req.StartTime)
		if err != nil {
			common.ApiErrorMsg(c, "开始时间格式错误，应为 HH:mm")
			return
		}
	}
	if req.EndMinute != nil {
		endMinute = *req.EndMinute
	} else {
		endMinute, err = parseMinuteOfDay(req.EndTime)
		if err != nil {
			common.ApiErrorMsg(c, "结束时间格式错误，应为 HH:mm")
			return
		}
	}

	modelName := ratio_setting.FormatMatchingModelName(req.Model)
	if _, ok := ratio_setting.GetModelPrice(modelName, false); !ok && !ratio_setting.IsModelRatioConfigured(modelName) {
		common.ApiErrorMsg(c, "模型未配置价格或倍率，请先在「分组与模型定价设置」中配置")
		return
	}

	rule, err := model.GetDailyWelfareRuleById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	rule.Enabled = req.Enabled
	rule.Model = modelName
	rule.StartMinute = startMinute
	rule.EndMinute = endMinute
	rule.Value = req.Value
	rule.CompletionRatio = req.CompletionRatio
	rule.CacheRatio = req.CacheRatio
	rule.CreateCacheRatio = req.CreateCacheRatio
	rule.ImageRatio = req.ImageRatio
	rule.AudioRatio = req.AudioRatio
	rule.AudioCompletionRatio = req.AudioCompletionRatio
	rule.Priority = req.Priority
	if err := model.UpdateDailyWelfareRule(rule); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidateDailyWelfareRuleCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新成功",
		"data":    rule,
	})
}

func DeleteDailyWelfareRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteDailyWelfareRule(id); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidateDailyWelfareRuleCache()
	common.ApiSuccess(c, true)
}

type DailyWelfareRuleModelMeta struct {
	Model                string  `json:"model"`
	FormattedModel       string  `json:"formatted_model"`
	UsePrice             bool    `json:"use_price"`
	ModelPrice           float64 `json:"model_price"`
	ModelRatio           float64 `json:"model_ratio"`
	CompletionRatio      float64 `json:"completion_ratio"`
	CacheRatio           float64 `json:"cache_ratio"`
	CreateCacheRatio     float64 `json:"create_cache_ratio"`
	ImageRatio           float64 `json:"image_ratio"`
	AudioRatio           float64 `json:"audio_ratio"`
	AudioCompletionRatio float64 `json:"audio_completion_ratio"`
}

func GetDailyWelfareRuleModelMeta(c *gin.Context) {
	modelName := strings.TrimSpace(c.Query("model"))
	if modelName == "" {
		common.ApiErrorMsg(c, "缺少 model 参数")
		return
	}
	formattedModelName := ratio_setting.FormatMatchingModelName(modelName)
	_, hasPrice := ratio_setting.GetModelPrice(formattedModelName, false)
	if !hasPrice && !ratio_setting.IsModelRatioConfigured(formattedModelName) {
		common.ApiErrorMsg(c, "模型未配置价格或倍率，请先在「分组与模型定价设置」中配置")
		return
	}

	modelPrice, hasPrice := ratio_setting.GetModelPrice(formattedModelName, false)
	modelRatio, _, _ := ratio_setting.GetModelRatio(formattedModelName)
	completionRatio := ratio_setting.GetCompletionRatio(formattedModelName)
	cacheRatio, _ := ratio_setting.GetCacheRatio(formattedModelName)
	createCacheRatio, _ := ratio_setting.GetCreateCacheRatio(formattedModelName)
	imageRatio, _ := ratio_setting.GetImageRatio(formattedModelName)
	audioRatio := ratio_setting.GetAudioRatio(formattedModelName)
	audioCompletionRatio := ratio_setting.GetAudioCompletionRatio(formattedModelName)

	common.ApiSuccess(c, DailyWelfareRuleModelMeta{
		Model:                modelName,
		FormattedModel:       formattedModelName,
		UsePrice:             hasPrice,
		ModelPrice:           modelPrice,
		ModelRatio:           modelRatio,
		CompletionRatio:      completionRatio,
		CacheRatio:           cacheRatio,
		CreateCacheRatio:     createCacheRatio,
		ImageRatio:           imageRatio,
		AudioRatio:           audioRatio,
		AudioCompletionRatio: audioCompletionRatio,
	})
}
