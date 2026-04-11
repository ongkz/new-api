package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type ErrorReplaceRuleRequest struct {
	Name               string `json:"name"`
	Enabled            bool   `json:"enabled"`
	MatchType          string `json:"match_type"`
	StatusCode         int    `json:"status_code"`
	Pattern            string `json:"pattern"`
	ReplacementMessage string `json:"replacement_message"`
	Priority           int64  `json:"priority"`
}

func ListErrorReplaceRules(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	rules, total, err := model.GetErrorReplaceRulePage(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(rules)
	common.ApiSuccess(c, pageInfo)
}

func CreateErrorReplaceRule(c *gin.Context) {
	var req ErrorReplaceRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	rule := &model.ErrorReplaceRule{
		Name:               req.Name,
		Enabled:            req.Enabled,
		MatchType:          req.MatchType,
		StatusCode:         req.StatusCode,
		Pattern:            req.Pattern,
		ReplacementMessage: req.ReplacementMessage,
		Priority:           req.Priority,
	}
	if err := model.CreateErrorReplaceRule(rule); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidateErrorReplaceRuleCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建成功",
		"data":    rule,
	})
}

func UpdateErrorReplaceRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req ErrorReplaceRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	rule, err := model.GetErrorReplaceRuleById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	rule.Name = req.Name
	rule.Enabled = req.Enabled
	rule.MatchType = req.MatchType
	rule.StatusCode = req.StatusCode
	rule.Pattern = req.Pattern
	rule.ReplacementMessage = req.ReplacementMessage
	rule.Priority = req.Priority
	if err := model.UpdateErrorReplaceRule(rule); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidateErrorReplaceRuleCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新成功",
		"data":    rule,
	})
}

func DeleteErrorReplaceRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteErrorReplaceRule(id); err != nil {
		common.ApiError(c, err)
		return
	}
	service.InvalidateErrorReplaceRuleCache()
	common.ApiSuccess(c, true)
}
