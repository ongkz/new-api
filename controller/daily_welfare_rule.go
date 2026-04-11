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
	Enabled     bool    `json:"enabled"`
	Model       string  `json:"model"`
	StartTime   string  `json:"start_time"`
	EndTime     string  `json:"end_time"`
	StartMinute *int    `json:"start_minute"`
	EndMinute   *int    `json:"end_minute"`
	Value       float64 `json:"value"`
	Priority    int64   `json:"priority"`
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
	if _, _, exist := ratio_setting.GetModelRatioOrPrice(modelName); !exist {
		common.ApiErrorMsg(c, "模型未配置价格或倍率，请先在「分组与模型定价设置」中配置")
		return
	}

	rule := &model.DailyWelfareRule{
		Enabled:     req.Enabled,
		Model:       modelName,
		StartMinute: startMinute,
		EndMinute:   endMinute,
		Value:       req.Value,
		Priority:    req.Priority,
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
	if _, _, exist := ratio_setting.GetModelRatioOrPrice(modelName); !exist {
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
