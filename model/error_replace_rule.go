package model

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	ErrorReplaceMatchTypeContent              = "content"
	ErrorReplaceMatchTypeStatusCode           = "status_code"
	ErrorReplaceMatchTypeStatusCodeAndContent = "status_code_and_content"
)

type ErrorReplaceRule struct {
	Id                 int       `json:"id" gorm:"primaryKey"`
	Name               string    `json:"name" gorm:"type:varchar(128);not null"`
	Enabled            bool      `json:"enabled" gorm:"default:false;index"`
	MatchType          string    `json:"match_type" gorm:"type:varchar(32);not null;index"`
	StatusCode         int       `json:"status_code" gorm:"default:0;index"`
	Pattern            string    `json:"pattern" gorm:"type:text"`
	ReplacementMessage string    `json:"replacement_message" gorm:"type:text;not null"`
	Priority           int64     `json:"priority" gorm:"bigint;default:0;index"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (ErrorReplaceRule) TableName() string {
	return "error_replace_rules"
}

func (r *ErrorReplaceRule) Validate() error {
	if r == nil {
		return errors.New("rule is nil")
	}
	r.Name = strings.TrimSpace(r.Name)
	r.MatchType = strings.TrimSpace(r.MatchType)
	r.Pattern = strings.TrimSpace(r.Pattern)
	r.ReplacementMessage = strings.TrimSpace(r.ReplacementMessage)

	if r.Name == "" {
		return errors.New("rule name is required")
	}
	switch r.MatchType {
	case ErrorReplaceMatchTypeContent, ErrorReplaceMatchTypeStatusCode, ErrorReplaceMatchTypeStatusCodeAndContent:
	default:
		return errors.New("invalid match type")
	}

	needStatusCode := r.MatchType == ErrorReplaceMatchTypeStatusCode || r.MatchType == ErrorReplaceMatchTypeStatusCodeAndContent
	if needStatusCode {
		if r.StatusCode < 100 || r.StatusCode > 599 {
			return errors.New("invalid status code")
		}
	} else {
		r.StatusCode = 0
	}

	needPattern := r.MatchType == ErrorReplaceMatchTypeContent || r.MatchType == ErrorReplaceMatchTypeStatusCodeAndContent
	if needPattern && r.Pattern == "" {
		return errors.New("pattern is required")
	}

	if r.ReplacementMessage == "" {
		return errors.New("replacement message is required")
	}
	return nil
}

func GetErrorReplaceRuleById(id int) (*ErrorReplaceRule, error) {
	var rule ErrorReplaceRule
	if err := DB.First(&rule, id).Error; err != nil {
		return nil, err
	}
	return &rule, nil
}

func GetErrorReplaceRulePage(startIdx int, pageSize int) ([]*ErrorReplaceRule, int64, error) {
	var rules []*ErrorReplaceRule
	var total int64
	if err := DB.Model(&ErrorReplaceRule{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := DB.Order("id desc").Limit(pageSize).Offset(startIdx).Find(&rules).Error; err != nil {
		return nil, 0, err
	}
	return rules, total, nil
}

func GetEnabledErrorReplaceRules(orderByPriority bool) ([]*ErrorReplaceRule, error) {
	var rules []*ErrorReplaceRule
	tx := DB.Where("enabled = ?", true)
	if orderByPriority {
		tx = tx.Order("priority desc").Order("id asc")
	} else {
		tx = tx.Order("id asc")
	}
	if err := tx.Find(&rules).Error; err != nil {
		return nil, err
	}
	return rules, nil
}

func CreateErrorReplaceRule(rule *ErrorReplaceRule) error {
	if err := rule.Validate(); err != nil {
		return err
	}
	return DB.Create(rule).Error
}

func UpdateErrorReplaceRule(rule *ErrorReplaceRule) error {
	if err := rule.Validate(); err != nil {
		return err
	}
	return DB.Save(rule).Error
}

func DeleteErrorReplaceRule(id int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return tx.Delete(&ErrorReplaceRule{}, id).Error
	})
}
