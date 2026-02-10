package model

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

type DailyWelfareRule struct {
	Id          int     `json:"id" gorm:"primaryKey"`
	Enabled     bool    `json:"enabled" gorm:"default:false;index"`
	Model       string  `json:"model" gorm:"type:varchar(255);not null;index"`
	StartMinute int     `json:"start_minute" gorm:"not null;index"`
	EndMinute   int     `json:"end_minute" gorm:"not null;index"`
	Value       float64 `json:"value" gorm:"not null"`
	// Optional overrides for ratio-based billing. Nil means "use existing ratio settings".
	CompletionRatio      *float64  `json:"completion_ratio,omitempty"`
	CacheRatio           *float64  `json:"cache_ratio,omitempty"`
	CreateCacheRatio     *float64  `json:"create_cache_ratio,omitempty"`
	ImageRatio           *float64  `json:"image_ratio,omitempty"`
	AudioRatio           *float64  `json:"audio_ratio,omitempty"`
	AudioCompletionRatio *float64  `json:"audio_completion_ratio,omitempty"`
	Priority             int64     `json:"priority" gorm:"bigint;default:0;index"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

func (DailyWelfareRule) TableName() string {
	return "daily_welfare_rules"
}

func (r *DailyWelfareRule) Validate() error {
	if r == nil {
		return errors.New("rule is nil")
	}
	r.Model = strings.TrimSpace(r.Model)
	if r.Model == "" {
		return errors.New("model is required")
	}
	if r.StartMinute < 0 || r.StartMinute > 1439 {
		return errors.New("invalid start minute")
	}
	if r.EndMinute < 0 || r.EndMinute > 1439 {
		return errors.New("invalid end minute")
	}
	if r.Value < 0 {
		return errors.New("value must be >= 0")
	}
	if r.CompletionRatio != nil && *r.CompletionRatio < 0 {
		return errors.New("completion ratio must be >= 0")
	}
	if r.CacheRatio != nil && *r.CacheRatio < 0 {
		return errors.New("cache ratio must be >= 0")
	}
	if r.CreateCacheRatio != nil && *r.CreateCacheRatio < 0 {
		return errors.New("create cache ratio must be >= 0")
	}
	if r.ImageRatio != nil && *r.ImageRatio < 0 {
		return errors.New("image ratio must be >= 0")
	}
	if r.AudioRatio != nil && *r.AudioRatio < 0 {
		return errors.New("audio ratio must be >= 0")
	}
	if r.AudioCompletionRatio != nil && *r.AudioCompletionRatio < 0 {
		return errors.New("audio completion ratio must be >= 0")
	}
	return nil
}

func GetDailyWelfareRuleById(id int) (*DailyWelfareRule, error) {
	var rule DailyWelfareRule
	if err := DB.First(&rule, id).Error; err != nil {
		return nil, err
	}
	return &rule, nil
}

func GetDailyWelfareRulePage(startIdx int, pageSize int) ([]*DailyWelfareRule, int64, error) {
	var rules []*DailyWelfareRule
	var total int64
	if err := DB.Model(&DailyWelfareRule{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := DB.Order("id desc").Limit(pageSize).Offset(startIdx).Find(&rules).Error; err != nil {
		return nil, 0, err
	}
	return rules, total, nil
}

func GetEnabledDailyWelfareRules(orderByPriority bool) ([]*DailyWelfareRule, error) {
	var rules []*DailyWelfareRule
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

func CreateDailyWelfareRule(rule *DailyWelfareRule) error {
	if err := rule.Validate(); err != nil {
		return err
	}
	return DB.Create(rule).Error
}

func UpdateDailyWelfareRule(rule *DailyWelfareRule) error {
	if err := rule.Validate(); err != nil {
		return err
	}
	return DB.Save(rule).Error
}

func DeleteDailyWelfareRule(id int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return tx.Delete(&DailyWelfareRule{}, id).Error
	})
}
