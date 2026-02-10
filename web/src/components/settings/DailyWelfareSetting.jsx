/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconEdit,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

import { API, showError, showSuccess } from '../../helpers';
import { selectFilter } from '../../helpers/utils';

const { Text } = Typography;

const buildShowTotal = (_t, total, range) => {
  const start = range?.[0] ?? 0;
  const end = range?.[1] ?? 0;
  return `显示第 ${start} 条-第 ${end} 条，共 ${total} 条`;
};

const formatMinuteToTime = (minute) => {
  const m = Number(minute);
  if (!Number.isFinite(m) || m < 0) return '-';
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const DailyWelfareSetting = () => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modelOptionsLoading, setModelOptionsLoading] = useState(false);
  const [modelOptions, setModelOptions] = useState([]);
  const [modelPriceMap, setModelPriceMap] = useState({});
  const [modelRatioMap, setModelRatioMap] = useState({});

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formValues, setFormValues] = useState({
    enabled: true,
    model: '',
    start_minute: 0,
    end_minute: 0,
    value: 0,
    priority: 0,
  });

  const timeOptions = useMemo(() => {
    const options = [];
    for (let minute = 0; minute < 24 * 60; minute += 1) {
      options.push({
        label: formatMinuteToTime(minute),
        value: minute,
      });
    }
    return options;
  }, []);

  const modelOptionList = useMemo(() => {
    const current = String(formValues.model || '').trim();
    if (!current) return modelOptions;
    if (modelOptions.some((o) => o?.value === current)) return modelOptions;
    return [{ label: current, value: current }, ...modelOptions];
  }, [formValues.model, modelOptions]);

  const fetchList = async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/daily-welfare-rule/?p=${page}&page_size=${size}`
      );
      if (res.data.success) {
        const data = res.data.data || {};
        setItems(data.items || []);
        setTotal(data.total || 0);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('获取每日福利规则失败'));
    }
    setLoading(false);
  };

  const fetchModelOptions = async () => {
    setModelOptionsLoading(true);
    try {
      const [enabledModelsRes, optionsRes] = await Promise.all([
        API.get('/api/channel/models_enabled'),
        API.get('/api/option/'),
      ]);

      const modelSet = new Set();
      let nextModelPriceMap = {};
      let nextModelRatioMap = {};

      const enabledModels = enabledModelsRes?.data?.success
        ? enabledModelsRes.data.data || []
        : [];
      enabledModels.forEach((m) => modelSet.add(m));

      if (optionsRes?.data?.success) {
        const options = optionsRes.data.data || [];
        const findOptionValue = (key) =>
          options.find((o) => o?.key === key)?.value;
        const parseJSONMap = (jsonStr) => {
          if (!jsonStr) return {};
          try {
            const obj = JSON.parse(jsonStr);
            if (obj && typeof obj === 'object') return obj;
            return {};
          } catch {
            return {};
          }
        };

        nextModelPriceMap = parseJSONMap(findOptionValue('ModelPrice'));
        nextModelRatioMap = parseJSONMap(findOptionValue('ModelRatio'));

        Object.keys(nextModelPriceMap).forEach((k) => modelSet.add(k));
        Object.keys(nextModelRatioMap).forEach((k) => modelSet.add(k));
      }

      const list = Array.from(modelSet)
        .map((m) => String(m || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      setModelOptions(list.map((m) => ({ label: m, value: m })));
      setModelPriceMap(nextModelPriceMap);
      setModelRatioMap(nextModelRatioMap);
    } catch (e) {
      showError(t('获取模型列表失败'));
      setModelPriceMap({});
      setModelRatioMap({});
    } finally {
      setModelOptionsLoading(false);
    }
  };

  const formatMatchingModelName = (name) => {
    let n = String(name || '').trim();
    const handleThinkingBudget = (prefix, wildcard) => {
      if (n.startsWith(prefix) && n.includes('-thinking-')) return wildcard;
      return n;
    };

    if (n.startsWith('gemini-2.5-flash-lite')) {
      n = handleThinkingBudget(
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash-lite-thinking-*'
      );
    } else if (n.startsWith('gemini-2.5-flash')) {
      n = handleThinkingBudget('gemini-2.5-flash', 'gemini-2.5-flash-thinking-*');
    } else if (n.startsWith('gemini-2.5-pro')) {
      n = handleThinkingBudget('gemini-2.5-pro', 'gemini-2.5-pro-thinking-*');
    }

    if (n.startsWith('gpt-4-gizmo')) {
      n = 'gpt-4-gizmo-*';
    }
    if (n.startsWith('gpt-4o-gizmo')) {
      n = 'gpt-4o-gizmo-*';
    }

    return n;
  };

  const getPricingMeta = (modelName) => {
    const formattedModelName = formatMatchingModelName(modelName);
    if (
      formattedModelName &&
      Object.prototype.hasOwnProperty.call(modelPriceMap, formattedModelName)
    ) {
      return {
        type: 'price',
        formattedModelName,
        currentValue: modelPriceMap[formattedModelName],
      };
    }
    if (
      formattedModelName &&
      Object.prototype.hasOwnProperty.call(modelRatioMap, formattedModelName)
    ) {
      return {
        type: 'ratio',
        formattedModelName,
        currentValue: modelRatioMap[formattedModelName],
      };
    }
    return { type: 'unknown', formattedModelName, currentValue: null };
  };

  const selectedPricingMeta = useMemo(
    () => getPricingMeta(formValues.model),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formValues.model, modelPriceMap, modelRatioMap]
  );

  useEffect(() => {
    fetchList(1, pageSize);
    fetchModelOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddModal = () => {
    setEditingRule(null);
    setFormValues({
      enabled: true,
      model: '',
      start_minute: 0,
      end_minute: 0,
      value: 0,
      priority: 0,
    });
    setModalVisible(true);
  };

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setFormValues({
      enabled: !!rule?.enabled,
      model: rule?.model ?? '',
      start_minute: rule?.start_minute ?? 0,
      end_minute: rule?.end_minute ?? 0,
      value: rule?.value ?? 0,
      priority: rule?.priority ?? 0,
    });
    setModalVisible(true);
  };

  const validateForm = () => {
    if (!formValues.model?.trim()) {
      showError(t('请选择模型'));
      return false;
    }
    const startMinute = Number(formValues.start_minute);
    const endMinute = Number(formValues.end_minute);
    if (!Number.isFinite(startMinute) || startMinute < 0 || startMinute > 1439) {
      showError(t('请选择开始时间'));
      return false;
    }
    if (!Number.isFinite(endMinute) || endMinute < 0 || endMinute > 1439) {
      showError(t('请选择结束时间'));
      return false;
    }
    if (
      !Number.isFinite(Number(formValues.value)) ||
      Number(formValues.value) < 0
    ) {
      if (selectedPricingMeta.type === 'price') {
        showError(t('请输入合法的福利固定价格'));
      } else if (selectedPricingMeta.type === 'ratio') {
        showError(t('请输入合法的福利倍率'));
      } else {
        showError(t('请输入合法的福利价格/倍率'));
      }
      return false;
    }
    return { startMinute, endMinute };
  };

  const submit = async () => {
    const validated = validateForm();
    if (!validated) return;
    const payload = {
      enabled: formValues.enabled,
      model: formValues.model,
      start_minute: validated.startMinute,
      end_minute: validated.endMinute,
      value: Number(formValues.value),
      priority: Number(formValues.priority) || 0,
    };
    try {
      let res;
      if (editingRule?.id) {
        res = await API.put(`/api/daily-welfare-rule/${editingRule.id}`, payload);
      } else {
        res = await API.post('/api/daily-welfare-rule/', payload);
      }
      if (res.data.success) {
        showSuccess(editingRule?.id ? t('更新成功') : t('创建成功'));
        setModalVisible(false);
        fetchList(1, pageSize);
        setCurrentPage(1);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(editingRule?.id ? t('更新失败') : t('创建失败'));
    }
  };

  const deleteRule = async (id) => {
    try {
      const res = await API.delete(`/api/daily-welfare-rule/${id}`);
      if (res.data.success) {
        showSuccess(t('删除成功'));
        fetchList(currentPage, pageSize);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('删除失败'));
    }
  };

  const updateEnabled = async (rule, enabled) => {
    if (!rule?.id) return;
    try {
      const res = await API.put(`/api/daily-welfare-rule/${rule.id}`, {
        enabled,
        model: rule.model,
        start_minute: rule.start_minute,
        end_minute: rule.end_minute,
        value: rule.value,
        priority: rule.priority,
      });
      if (res.data.success) {
        fetchList(currentPage, pageSize);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('更新失败'));
    }
  };

  const columns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
      {
        title: t('启用'),
        dataIndex: 'enabled',
        key: 'enabled',
        width: 90,
        render: (enabled, record) => (
          <Switch
            checked={!!enabled}
            onChange={(checked) => updateEnabled(record, checked)}
          />
        ),
      },
      { title: t('模型'), dataIndex: 'model', key: 'model', width: 220 },
      {
        title: t('开始时间'),
        dataIndex: 'start_minute',
        key: 'start_minute',
        width: 120,
        render: (v) => formatMinuteToTime(v),
      },
      {
        title: t('结束时间'),
        dataIndex: 'end_minute',
        key: 'end_minute',
        width: 120,
        render: (v) => formatMinuteToTime(v),
      },
      {
        title: t('福利价格/倍率'),
        dataIndex: 'value',
        key: 'value',
        width: 160,
        render: (v, record) => {
          const meta = getPricingMeta(record?.model);
          const prefix =
            meta.type === 'price'
              ? t('价格')
              : meta.type === 'ratio'
                ? t('倍率')
                : '';
          const display = prefix ? `${prefix}: ${String(v)}` : String(v);
          return (
            <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 140 }}>
              {display}
            </Text>
          );
        },
      },
      { title: t('优先级'), dataIndex: 'priority', key: 'priority', width: 100 },
      {
        title: t('操作'),
        key: 'actions',
        width: 140,
        render: (_, record) => (
          <Space>
            <Button icon={<IconEdit />} onClick={() => openEditModal(record)}>
              {t('编辑')}
            </Button>
            <Popconfirm
              title={t('确定要删除该规则吗？')}
              onConfirm={() => deleteRule(record.id)}
            >
              <Button type='danger' icon={<IconDelete />}>
                {t('删除')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, currentPage, pageSize, items, modelPriceMap, modelRatioMap]
  );

  return (
    <Card
      title={t('每日福利设置')}
      headerExtraContent={
        <Space>
          <Button
            icon={<IconRefresh />}
            onClick={() => {
              fetchList(currentPage, pageSize);
              fetchModelOptions();
            }}
          >
            {t('刷新')}
          </Button>
          <Button type='primary' onClick={openAddModal}>
            {t('+ 添加规则')}
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={items}
        rowKey='id'
        loading={loading}
        pagination={{
          currentPage,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10'],
          showQuickJumper: true,
          showTotal: (total, range) => buildShowTotal(t, total, range),
          onPageChange: (page) => {
            setCurrentPage(page);
            fetchList(page, pageSize);
          },
          onPageSizeChange: (size) => {
            setPageSize(size);
            setCurrentPage(1);
            fetchList(1, size);
          },
        }}
      />

      <Modal
        title={editingRule?.id ? t('编辑每日福利规则') : t('添加每日福利规则')}
        visible={modalVisible}
        onOk={submit}
        onCancel={() => setModalVisible(false)}
        okText={editingRule?.id ? t('更新') : t('创建')}
        cancelText={t('取消')}
      >
        <Form labelPosition='top'>
          <Form.Switch
            field='enabled'
            label={t('启用')}
            checked={formValues.enabled}
            onChange={(checked) =>
              setFormValues((v) => ({ ...v, enabled: checked }))
            }
          />
          <Form.Slot label={t('模型')}>
            <Select
              placeholder={t('请选择模型')}
              value={formValues.model}
              onChange={(value) =>
                setFormValues((v) => ({ ...v, model: value }))
              }
              optionList={modelOptionList}
              filter={selectFilter}
              autoClearSearchValue={false}
              searchPosition='dropdown'
              searchable
              showClear
              loading={modelOptionsLoading}
              style={{ width: '100%' }}
            />
            {formValues.model ? (
              <Text
                type='tertiary'
                size='small'
                style={{ display: 'block', marginTop: 6 }}
              >
                {selectedPricingMeta.type === 'price'
                  ? t('计费方式：固定价格（优先级高于模型倍率）')
                  : selectedPricingMeta.type === 'ratio'
                    ? t('计费方式：倍率')
                    : t('计费方式：未知')}
                {selectedPricingMeta.type === 'price'
                  ? `；${t('当前固定价格')}: ${
                      selectedPricingMeta.currentValue ?? '-'
                    }`
                  : selectedPricingMeta.type === 'ratio'
                    ? `；${t('当前倍率')}: ${selectedPricingMeta.currentValue ?? '-'}`
                    : ''}
                {selectedPricingMeta.formattedModelName &&
                selectedPricingMeta.formattedModelName !==
                  String(formValues.model || '').trim()
                  ? `；${t('归一化后模型')}: ${selectedPricingMeta.formattedModelName}`
                  : ''}
              </Text>
            ) : null}
          </Form.Slot>
          <Form.Slot label={t('开始时间')}>
            <Select
              placeholder={t('请选择开始时间')}
              value={formValues.start_minute}
              onChange={(value) =>
                setFormValues((v) => ({ ...v, start_minute: Number(value) }))
              }
              optionList={timeOptions}
              filter={selectFilter}
              autoClearSearchValue={false}
              searchPosition='dropdown'
              searchable
              style={{ width: '100%' }}
            />
          </Form.Slot>
          <Form.Slot label={t('结束时间')}>
            <Select
              placeholder={t('请选择结束时间')}
              value={formValues.end_minute}
              onChange={(value) =>
                setFormValues((v) => ({ ...v, end_minute: Number(value) }))
              }
              optionList={timeOptions}
              filter={selectFilter}
              autoClearSearchValue={false}
              searchPosition='dropdown'
              searchable
              style={{ width: '100%' }}
            />
          </Form.Slot>
          <Form.Slot
            label={
              selectedPricingMeta.type === 'price'
                ? t('福利固定价格')
                : selectedPricingMeta.type === 'ratio'
                  ? t('福利倍率')
                  : t('福利价格/倍率')
            }
          >
            <InputNumber
              value={formValues.value}
              onChange={(value) => setFormValues((v) => ({ ...v, value }))}
              min={0}
              placeholder={
                selectedPricingMeta.type === 'price'
                  ? t('例如 0.1（USD/次）')
                  : selectedPricingMeta.type === 'ratio'
                    ? t('例如 37.5')
                    : undefined
              }
              style={{ width: '100%' }}
            />
            <Text
              type='tertiary'
              size='small'
              style={{ display: 'block', marginTop: 6 }}
            >
              {selectedPricingMeta.type === 'price'
                ? t('与「模型固定价格」一致：一次调用消耗多少刀（USD/次），优先级高于模型倍率。')
                : selectedPricingMeta.type === 'ratio'
                  ? t('与「模型倍率」一致：按 token 计费时使用的倍率。')
                  : t('请先在「分组与模型定价设置」中配置模型价格或倍率。')}
            </Text>
          </Form.Slot>
          <Form.InputNumber
            field='priority'
            label={t('优先级')}
            value={formValues.priority}
            onChange={(value) =>
              setFormValues((v) => ({ ...v, priority: value }))
            }
          />
        </Form>
      </Modal>
    </Card>
  );
};

export default DailyWelfareSetting;
