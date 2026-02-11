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
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconEdit,
  IconPlus,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

import { API, showError, showSuccess } from '../../helpers';

const { Text } = Typography;

const MATCH_TYPE_OPTIONS = [
  { value: 'content', label: '内容' },
  { value: 'status_code', label: '状态码' },
  { value: 'status_code_and_content', label: '状态码+内容' },
];

const getMatchTypeLabel = (value) => {
  const found = MATCH_TYPE_OPTIONS.find((o) => o.value === value);
  return found ? found.label : value || '-';
};

const buildShowTotal = (_t, total, range) => {
  const start = range?.[0] ?? 0;
  const end = range?.[1] ?? 0;
  return `显示第 ${start} 条-第 ${end} 条，共 ${total} 条`;
};

const ErrorReplaceSetting = () => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formValues, setFormValues] = useState({
    name: '',
    enabled: true,
    match_type: 'content',
    status_code: 500,
    pattern: '',
    replacement_message: '',
    priority: 0,
  });

  const fetchList = async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/error-replace-rule/?p=${page}&page_size=${size}`,
      );
      if (res.data.success) {
        const data = res.data.data || {};
        setItems(data.items || []);
        setTotal(data.total || 0);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('获取错误替换规则失败'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchList(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddModal = () => {
    setEditingRule(null);
    setFormValues({
      name: '',
      enabled: true,
      match_type: 'content',
      status_code: 500,
      pattern: '',
      replacement_message: '',
      priority: 0,
    });
    setModalVisible(true);
  };

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setFormValues({
      name: rule?.name ?? '',
      enabled: !!rule?.enabled,
      match_type: rule?.match_type ?? 'content',
      status_code: rule?.status_code ?? 500,
      pattern: rule?.pattern ?? '',
      replacement_message: rule?.replacement_message ?? '',
      priority: rule?.priority ?? 0,
    });
    setModalVisible(true);
  };

  const validateForm = () => {
    if (!formValues.name?.trim()) {
      showError(t('请输入规则名称'));
      return false;
    }
    if (!formValues.match_type) {
      showError(t('请选择匹配类型'));
      return false;
    }
    const needStatusCode =
      formValues.match_type === 'status_code' ||
      formValues.match_type === 'status_code_and_content';
    if (needStatusCode) {
      const code = Number(formValues.status_code);
      if (!Number.isFinite(code) || code < 100 || code > 599) {
        showError(t('请输入合法的状态码'));
        return false;
      }
    }
    const needPattern =
      formValues.match_type === 'content' ||
      formValues.match_type === 'status_code_and_content';
    if (needPattern && !formValues.pattern?.trim()) {
      showError(t('请输入匹配模式'));
      return false;
    }
    if (!formValues.replacement_message?.trim()) {
      showError(t('请输入替换消息'));
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validateForm()) return;
    try {
      let res;
      if (editingRule?.id) {
        res = await API.put(
          `/api/error-replace-rule/${editingRule.id}`,
          formValues,
        );
      } else {
        res = await API.post('/api/error-replace-rule/', formValues);
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
      const res = await API.delete(`/api/error-replace-rule/${id}`);
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
      const res = await API.put(`/api/error-replace-rule/${rule.id}`, {
        ...rule,
        enabled,
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
      { title: t('名称'), dataIndex: 'name', key: 'name', width: 160 },
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
      {
        title: t('匹配类型'),
        dataIndex: 'match_type',
        key: 'match_type',
        width: 140,
        render: (v) => <Text>{t(getMatchTypeLabel(v))}</Text>,
      },
      {
        title: t('状态码'),
        dataIndex: 'status_code',
        key: 'status_code',
        width: 110,
        render: (v) => (v ? String(v) : '-'),
      },
      {
        title: t('匹配模式'),
        dataIndex: 'pattern',
        key: 'pattern',
        render: (v) => (
          <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 260 }}>
            {v || '-'}
          </Text>
        ),
      },
      {
        title: t('替换消息'),
        dataIndex: 'replacement_message',
        key: 'replacement_message',
        render: (v) => (
          <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 320 }}>
            {v || '-'}
          </Text>
        ),
      },
      {
        title: t('优先级'),
        dataIndex: 'priority',
        key: 'priority',
        width: 100,
      },
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
    [t, currentPage, pageSize, items],
  );

  return (
    <Card
      title={t('错误替换规则')}
      headerExtraContent={
        <Space>
          <Button
            icon={<IconRefresh />}
            onClick={() => fetchList(currentPage, pageSize)}
          >
            {t('刷新')}
          </Button>
          <Button type='primary' icon={<IconPlus />} onClick={openAddModal}>
            {t('添加规则')}
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
        title={editingRule?.id ? t('编辑错误替换规则') : t('添加错误替换规则')}
        visible={modalVisible}
        onOk={submit}
        onCancel={() => setModalVisible(false)}
        okText={editingRule?.id ? t('更新') : t('创建')}
        cancelText={t('取消')}
      >
        <Form
          key={`${editingRule?.id ?? 'new'}-${modalVisible ? 'open' : 'closed'}`}
          labelPosition='top'
          initValues={formValues}
          onValueChange={(values) => setFormValues(values)}
        >
          <Form.Input
            field='name'
            label={t('规则名称')}
            placeholder={t('例如：参数错误')}
            extraText={t('仅用于管理端识别，建议简短描述')}
            required
          />
          <Form.Switch field='enabled' label={t('启用')} />
          <Form.Select
            field='match_type'
            label={t('匹配类型')}
            placeholder={t('请选择匹配类型')}
            optionList={MATCH_TYPE_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.label),
            }))}
            style={{ width: '100%' }}
            dropdownStyle={{ width: '100%', maxWidth: '100%' }}
            extraText={t(
              '内容：pattern 为子串匹配；状态码：仅匹配 HTTP 状态码；状态码+内容：两者都满足。',
            )}
            required
          />
          {(formValues.match_type === 'status_code' ||
            formValues.match_type === 'status_code_and_content') && (
            <Form.InputNumber
              field='status_code'
              label={t('状态码')}
              min={100}
              max={599}
              placeholder={500}
              style={{ width: '100%' }}
            />
          )}
          <Form.TextArea
            field='pattern'
            label={t('匹配模式')}
            autosize={{ minRows: 2, maxRows: 6 }}
            placeholder={t('例如：MODEL_CAPACITY_EXHAUSTED')}
            extraText={t(
              '匹配文本包含 status_code=<HTTP状态码>、上游原始 body、解析出的 error.message 等。',
            )}
            disabled={formValues.match_type === 'status_code'}
          />
          <Form.TextArea
            field='replacement_message'
            label={t('替换消息')}
            autosize={{ minRows: 2, maxRows: 6 }}
            placeholder={t('例如：429了老铁')}
            extraText={t('命中后将返回给客户端的错误 message 替换为该文本')}
            required
          />
          <Form.InputNumber
            field='priority'
            label={t('优先级')}
            placeholder={0}
            style={{ width: '100%' }}
            extraText={t('优先级越大越优先')}
          />
        </Form>
      </Modal>
    </Card>
  );
};

export default ErrorReplaceSetting;
