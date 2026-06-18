import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Template } from '../lib/api';
import { useStore } from '../store';
import { Plus, Edit2, Trash2, FileText, Eye } from 'lucide-react';

export default function Templates() {
  const user = useStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCat, setFilterCat] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<{
    name: string;
    category: string;
    content: string;
    variables: { name: string; type: string; description: string }[];
  }>({
    name: '',
    category: '劳动合同',
    content: '',
    variables: [],
  });

  const load = () => {
    api.getTemplates(filterCat || undefined).then(setTemplates).catch(() => {});
    api.getTemplateCategories().then(setCategories).catch(() => {});
  };

  useEffect(() => { load(); }, [filterCat]);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: '',
      category: categories[0] || '劳动合同',
      content: '<div style="padding:40px;font-family:SimSun,serif;"><h2 style="text-align:center;">合同标题</h2><p>甲方：{{甲方名称}}</p><p>乙方：{{乙方名称}}</p><p>合同正文内容...</p></div>',
      variables: [],
    });
    setShowModal(true);
  };

  const openEdit = async (t: Template) => {
    const full = await api.getTemplate(t.id);
    setEditing(full);
    setForm({
      name: full.name,
      category: full.category,
      content: full.content,
      variables: (full.variables || []).map((v) => ({
        name: v.name,
        type: v.type,
        description: v.description,
      })),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.content) {
      alert('请填写模板名称和内容');
      return;
    }
    try {
      if (editing) {
        await api.updateTemplate(editing.id, form as any);
      } else {
        await api.createTemplate(form as any);
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此模板？')) return;
    await api.deleteTemplate(id);
    load();
  };

  const addVariable = () => {
    setForm({
      ...form,
      variables: [...form.variables, { name: '', type: 'text', description: '' }],
    });
  };

  const updateVar = (idx: number, key: string, val: string) => {
    const vars = [...form.variables];
    (vars[idx] as any)[key] = val;
    setForm({ ...form, variables: vars });
  };

  const removeVar = (idx: number) => {
    const vars = form.variables.filter((_, i) => i !== idx);
    setForm({ ...form, variables: vars });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">共 {templates.length} 个模板</span>
        </div>
        {isAdmin && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            新建模板
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    {t.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{t.category} · {t.creator_name}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded">{t.category}</span>
              </div>
              <div
                className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-600 overflow-hidden"
                style={{ maxHeight: '120px' }}
                dangerouslySetInnerHTML={{ __html: t.content }}
              />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <Link
                to={`/contracts/create?templateId=${t.id}`}
                className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                使用
              </Link>
              {isAdmin && (
                <>
                  <button
                    onClick={() => openEdit(t)}
                    className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">{editing ? '编辑模板' : '新建模板'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模板名称</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模板分类</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">变量定义</label>
                <div className="space-y-2 mb-2">
                  {form.variables.map((v, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        placeholder="变量名（如：甲方名称）"
                        value={v.name}
                        onChange={(e) => updateVar(idx, 'name', e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <select
                        value={v.type}
                        onChange={(e) => updateVar(idx, 'type', e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white w-24"
                      >
                        <option value="text">text</option>
                        <option value="number">number</option>
                        <option value="date">date</option>
                      </select>
                      <input
                        placeholder="描述"
                        value={v.description}
                        onChange={(e) => updateVar(idx, 'description', e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <button
                        onClick={() => removeVar(idx)}
                        className="px-2 text-red-500 hover:bg-red-50 rounded text-sm"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addVariable}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  + 添加变量
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">正文HTML内容</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  placeholder="使用 {{变量名}} 作为占位符"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">预览</label>
                <div
                  className="border border-gray-200 rounded-lg p-4 bg-white max-h-60 overflow-auto"
                  dangerouslySetInnerHTML={{ __html: form.content }}
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
