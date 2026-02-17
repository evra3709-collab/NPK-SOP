
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MaintenanceReport, DashboardStats, Attachment } from './types';
import { getMaintenanceAdvice } from './services/geminiService';
import { generatePDFReport } from './services/pdfService';
import { exportReportsToExcel, parseReportsFromExcel, downloadExcelTemplate } from './services/excelService';
import ReportCard from './components/ReportCard';
import { 
  LayoutDashboard, 
  PlusCircle, 
  ClipboardList, 
  Search, 
  Sparkles,
  Loader2,
  TrendingUp,
  History as HistoryIcon,
  X,
  Paperclip,
  Download,
  Square,
  CheckSquare,
  HardHat,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Upload,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Trash2,
  Archive,
  RefreshCcw,
  FileText,
  ChevronRight,
  Eye,
  LayoutGrid,
  List,
  FileIcon,
  Edit2,
  Clock,
  FileDown
} from 'lucide-react';

type TabType = 'dashboard' | 'reports' | 'history' | 'archive';
type ViewMode = 'card' | 'table';
type SortKey = 'index' | 'notificationNo' | 'workDept' | 'equipmentName' | 'dateTime' | 'workContent' | 'isCompleted';
type SortDirection = 'asc' | 'desc' | null;

// 대시보드 전용 확장형 카드 컴포넌트
const DashboardRecentCard: React.FC<{ r: MaintenanceReport, onEdit: (r: MaintenanceReport) => void, onDelete: (id: string) => void }> = ({ r, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div key={r.id} onClick={() => onEdit(r)} className="bg-white p-7 rounded-[3rem] border-2 border-transparent hover:border-npk-blue shadow-sm cursor-pointer group transition-all flex flex-col min-h-[280px] relative">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-npk-blue uppercase">#{r.notificationNo}</span>
          <span className="text-[9px] font-bold text-gray-400 italic">{r.failDate}</span>
        </div>
        <div className={`px-2 py-1 rounded-lg text-[9px] font-black border ${r.isCompleted ? 'bg-green-50 text-green-600 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'}`}>
          {r.isCompleted ? '완료' : '진행중'}
        </div>
      </div>
      <h5 className="font-black text-xl text-black truncate mb-2">{r.equipmentName}</h5>
      <p className="text-xs font-bold text-gray-500 line-clamp-2 italic mb-4 flex-1">"{r.workContent}"</p>
      
      {r.aiInsights && (
        <div 
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className={`mt-3 p-4 rounded-2xl border transition-all duration-300 ${isExpanded ? 'bg-npk-light/50 border-npk-blue/30' : 'bg-npk-light/30 border-npk-blue/10 hover:bg-npk-light/40'}`}
        >
          <div className="flex items-center justify-between mb-2 text-npk-blue">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-npk-yellow fill-npk-blue" />
              <span className="text-[10px] font-black uppercase tracking-tight">AI 기술권고</span>
            </div>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
          <p className={`text-[11px] font-bold text-black italic leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>
            "{r.aiInsights}"
          </p>
        </div>
      )}
      
      <div className="flex justify-between items-center text-[10px] font-black text-gray-400 mt-4">
        <div className="flex items-center gap-2">
          <span className="bg-gray-100 px-2 py-0.5 rounded-lg">{r.workDept}</span>
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(r.id); }}
            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-all"
            title="삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <Eye size={14} className="group-hover:text-npk-blue transition-colors" />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [reportViewMode, setReportViewMode] = useState<ViewMode>('card');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'dateTime', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('전체');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const excelUploadRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const [formData, setFormData] = useState({
    notificationNo: '', equipmentName: '', workDept: '공무', workContent: '', 
    failDate: '', failTime: '', cause: '', action: '', isCompleted: false
  });
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    const savedReports = localStorage.getItem('maintainer_reports');
    if (savedReports) {
      try {
        const parsed = JSON.parse(savedReports);
        if (Array.isArray(parsed)) setReports(parsed);
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('maintainer_reports', JSON.stringify(reports));
  }, [reports]);

  const stats: DashboardStats = useMemo(() => ({
    totalReports: reports.length,
    recentFailures: reports.filter(r => !r.isCompleted).length,
    aiAnalyzed: reports.filter(r => !!r.aiInsights).length
  }), [reports]);

  const handleOpenEdit = (report: MaintenanceReport) => {
    const index = reports.findIndex(r => String(r.id) === String(report.id));
    if (index === -1) return;
    setEditingIndex(index);
    setFormData({
      notificationNo: report.notificationNo || '',
      equipmentName: report.equipmentName || '',
      workDept: report.workDept || '공무',
      workContent: report.workContent || '',
      failDate: report.failDate || '',
      failTime: report.failTime || '',
      cause: report.cause || '',
      action: report.action || '',
      isCompleted: !!report.isCompleted
    });
    setAttachments(report.attachments || []);
    setIsFormOpen(true);
  };

  const handleDeleteIndividual = (id: string) => {
    const target = reports.find(r => String(r.id) === String(id));
    if (!target) return;
    
    if (window.confirm(`[${target.notificationNo || '알 수 없음'}] 정비 내역을 영구 삭제하시겠습니까?`)) {
      setReports(prev => prev.filter(r => String(r.id) !== String(id)));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(String(id));
        return next;
      });
      // 현재 모달에서 편집 중인 데이터를 삭제한 경우 모달 닫기 및 인덱스 초기화
      if (editingIndex !== null && reports[editingIndex]?.id === id) {
        setIsFormOpen(false);
        setEditingIndex(null);
      }
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseReportsFromExcel(file);
      const newReports: MaintenanceReport[] = parsed.map((r, i) => ({
        ...r,
        id: `REP-${Date.now()}-${i}`,
        createdAt: new Date().toLocaleDateString('ko-KR'),
        isArchived: false,
        attachments: []
      } as MaintenanceReport));
      setReports(prev => [...newReports, ...prev]);
      alert(`${newReports.length}건 업로드 완료`);
      if (excelUploadRef.current) excelUploadRef.current.value = '';
    } catch (err) { alert('엑셀 로드 오류'); }
  };

  const handleBulkArchive = (archive: boolean) => {
    const ids = Array.from(selectedIds);
    setReports(prev => prev.map(r => ids.includes(String(r.id)) ? { ...r, isArchived: archive } : r));
    setSelectedIds(new Set());
  };

  const handleBulkPDFDownload = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDownloading(true);
    const selectedReports = reports.filter(r => selectedIds.has(String(r.id)));
    await generatePDFReport(selectedReports);
    setIsBulkDownloading(false);
    setSelectedIds(new Set());
  };

  const toggleReportStatus = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, isCompleted: !r.isCompleted } : r));
  };

  const handleArchiveReport = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, isArchived: !r.isArchived } : r));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const strId = String(id);
      if (next.has(strId)) next.delete(strId);
      else next.add(strId);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key, direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  const filteredAndSortedReports = useMemo(() => {
    let result = reports.filter(r => {
      if (activeTab === 'reports') return !r.isArchived;
      if (activeTab === 'history') return true; 
      if (activeTab === 'archive') return r.isArchived;
      return true;
    }).filter(r => {
      const matchesSearch = (r.equipmentName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (r.notificationNo || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = filterDept === '전체' || r.workDept === filterDept;
      const matchesDate = (!startDate || r.failDate >= startDate) && (!endDate || r.failDate <= endDate);
      return matchesSearch && matchesDept && matchesDate;
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        let aVal: any = (a as any)[sortConfig.key];
        let bVal: any = (b as any)[sortConfig.key];
        if (sortConfig.key === 'dateTime') {
          aVal = `${a.failDate} ${a.failTime}`;
          bVal = `${b.failDate} ${b.failTime}`;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [reports, searchTerm, filterDept, startDate, endDate, activeTab, sortConfig]);

  const archivedByEquipment = useMemo(() => {
    const groups: Record<string, MaintenanceReport[]> = {};
    reports.filter(r => r.isArchived).forEach(r => {
      const name = r.equipmentName || '미지정';
      if (!groups[name]) groups[name] = [];
      groups[name].push(r);
    });
    return groups;
  }, [reports]);

  const filteredEquipmentNames = useMemo(() => {
    return Object.keys(archivedByEquipment)
      .filter(n => n.toLowerCase().includes(equipmentSearchTerm.toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'ko-KR'));
  }, [archivedByEquipment, equipmentSearchTerm]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortConfig.key !== col || !sortConfig.direction) return <ArrowUpDown size={14} className="ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-npk-yellow" /> : <ChevronDown size={14} className="ml-1 text-npk-yellow" />;
  };

  const TableView = ({ data }: { data: MaintenanceReport[] }) => (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-npk-blue text-white">
              <th className="px-6 py-6 w-16 text-center">
                <button onClick={() => {
                  const allIds = data.map(r => String(r.id));
                  const allSel = allIds.every(id => selectedIds.has(id));
                  if (allSel) setSelectedIds(new Set());
                  else setSelectedIds(new Set(allIds));
                }}>
                  {data.length > 0 && data.every(r => selectedIds.has(String(r.id))) ? <CheckSquare size={24} className="text-npk-yellow" /> : <Square size={24} className="text-white/40" />}
                </button>
              </th>
              <th className="px-4 py-6 w-20 text-sm font-black uppercase cursor-pointer" onClick={() => handleSort('index')}>No. <SortIcon col="index" /></th>
              <th className="px-4 py-6 w-36 text-sm font-black uppercase cursor-pointer" onClick={() => handleSort('notificationNo')}>통지번호 <SortIcon col="notificationNo" /></th>
              <th className="px-4 py-6 w-40 text-sm font-black uppercase cursor-pointer" onClick={() => handleSort('equipmentName')}>설비명 <SortIcon col="equipmentName" /></th>
              <th className="px-4 py-6 w-24 text-sm font-black uppercase cursor-pointer" onClick={() => handleSort('workDept')}>부서 <SortIcon col="workDept" /></th>
              <th className="px-4 py-6 w-32 text-sm font-black uppercase cursor-pointer" onClick={() => handleSort('dateTime')}>일시 <SortIcon col="dateTime" /></th>
              <th className="px-4 py-6 text-sm font-black uppercase min-w-[200px]">고장 내용</th>
              <th className="px-4 py-6 w-28 text-sm font-black uppercase cursor-pointer" onClick={() => handleSort('isCompleted')}>상태 <SortIcon col="isCompleted" /></th>
              <th className="px-6 py-6 w-32 text-sm font-black uppercase text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((r, idx) => {
              const displayNo = sortConfig.direction === 'desc' ? data.length - idx : idx + 1;
              return (
                <tr key={r.id} onClick={() => handleOpenEdit(r)} className={`cursor-pointer hover:bg-npk-light/30 transition-colors ${selectedIds.has(String(r.id)) ? 'bg-npk-light/50' : ''}`}>
                  <td className="px-6 py-6 text-center" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => toggleSelect(r.id)}>
                      {selectedIds.has(String(r.id)) ? <CheckSquare size={24} className="text-npk-blue" /> : <Square size={24} className="text-gray-200" />}
                    </button>
                  </td>
                  <td className="px-4 py-6 font-mono text-xs font-bold text-gray-400">{displayNo}</td>
                  <td className="px-4 py-6 font-mono text-sm font-black text-black">{r.notificationNo}</td>
                  <td className="px-4 py-6 font-black text-black text-sm truncate">{r.equipmentName}</td>
                  <td className="px-4 py-6"><span className="px-2 py-1 bg-gray-100 text-black text-[10px] font-black rounded-lg">{r.workDept}</span></td>
                  <td className="px-4 py-6 text-[11px] font-bold text-black">{r.failDate}<br/>{r.failTime}</td>
                  <td className="px-4 py-6 text-sm font-semibold text-black truncate">{r.workContent}</td>
                  <td className="px-4 py-6" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => toggleReportStatus(r.id)} className={`text-[10px] font-black inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${r.isCompleted ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'}`}>
                      {r.isCompleted ? <CheckCircle size={12}/> : <AlertTriangle size={12}/>}
                      {r.isCompleted ? '완료' : '진행중'}
                    </button>
                  </td>
                  <td className="px-6 py-6 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => handleOpenEdit(r)} className="p-1.5 hover:bg-npk-light text-black rounded-lg transition-colors"><Edit2 size={14}/></button>
                      <button onClick={() => handleArchiveReport(r.id)} className={`p-1.5 rounded-lg transition-colors ${r.isArchived ? 'bg-blue-50 text-npk-blue' : 'hover:bg-npk-light text-black'}`}>{r.isArchived ? <RefreshCcw size={14}/> : <Archive size={14}/>}</button>
                      <button onClick={() => handleDeleteIndividual(r.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    try {
      const aiAdvice = await getMaintenanceAdvice(formData.equipmentName, formData.cause);
      const report: MaintenanceReport = {
        id: editingIndex !== null ? reports[editingIndex].id : `REP-${Date.now()}`,
        ...formData,
        createdAt: editingIndex !== null ? reports[editingIndex].createdAt : new Date().toLocaleDateString('ko-KR'),
        aiInsights: aiAdvice,
        attachments: attachments,
        isArchived: editingIndex !== null ? (reports[editingIndex].isArchived || false) : false
      };
      if (editingIndex !== null) {
        setReports(prev => { const n = [...prev]; n[editingIndex] = report; return n; });
      } else {
        setReports(prev => [report, ...prev]);
      }
      setIsFormOpen(false);
      setEditingIndex(null);
      setFormData({ notificationNo: '', equipmentName: '', workDept: '공무', workContent: '', failDate: '', failTime: '', cause: '', action: '', isCompleted: false });
      setAttachments([]);
    } catch (err) { alert('오류 발생'); } finally { setIsAnalyzing(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <div className="fixed left-0 top-0 h-full w-64 bg-npk-blue text-white p-6 hidden lg:flex flex-col border-r border-npk-dark z-40 shadow-2xl">
        <div className="flex items-center space-x-3 mb-12">
          <div className="p-3 bg-npk-yellow text-npk-blue rounded-xl shadow-lg"><HardHat size={32} /></div>
          <h1 className="text-2xl font-black text-npk-yellow italic uppercase tracking-tight">NPK SOP</h1>
        </div>
        <nav className="flex-1 space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: '대시보드' },
            { id: 'reports', icon: ClipboardList, label: '정비 보고서' },
            { id: 'history', icon: HistoryIcon, label: '정비 요청' },
            { id: 'archive', icon: Archive, label: '정비 이력함' }
          ].map((item) => (
            <button key={item.id} onClick={() => { setActiveTab(item.id as TabType); setSelectedIds(new Set()); }} className={`w-full flex items-center space-x-3 px-4 py-4 rounded-2xl transition-all ${activeTab === item.id ? 'bg-npk-yellow text-npk-blue font-black shadow-lg translate-x-1' : 'hover:bg-white/10 text-white/70'}`}>
              <item.icon size={20} /> <span className="font-bold">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 lg:ml-64 p-4 md:p-8 lg:p-12">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-black text-npk-blue uppercase italic tracking-widest">NPK SOP MAINTENANCE</span>
            <h2 className="text-4xl font-black text-npk-dark tracking-tight">
              {activeTab === 'dashboard' && "통합 대시보드"}
              {activeTab === 'reports' && "정비 보고서 목록"}
              {activeTab === 'history' && "정비 요청 내역"}
              {activeTab === 'archive' && "설비별 정비 이력함"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={downloadExcelTemplate} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-500 hover:bg-gray-50 transition-colors"><FileText size={18} /> 양식 다운로드</button>
            <button onClick={() => { setIsFormOpen(true); setEditingIndex(null); }} className="flex items-center space-x-2 bg-npk-yellow text-npk-blue px-6 py-4 rounded-2xl font-black shadow-lg hover:bg-yellow-400 transition-all">
              <PlusCircle size={22} /> <span>새 보고서 작성</span>
            </button>
          </div>
        </header>

        {activeTab !== 'dashboard' && activeTab !== 'archive' && (
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="검색어 입력..." className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-npk-blue focus:bg-white rounded-xl outline-none font-bold text-sm text-black transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-3 w-full lg:justify-end">
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                  <Calendar size={14} className="text-npk-blue ml-1" />
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-bold outline-none cursor-pointer" />
                  <span className="text-gray-300 font-bold">~</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-bold outline-none cursor-pointer" />
                  {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-gray-400 hover:text-red-500"><X size={14}/></button>}
                </div>
                <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black outline-none focus:border-npk-blue cursor-pointer">
                  {['전체', '고정', '회전', '계기', '전기', '영선', '공무', '기술'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  {activeTab === 'reports' && (
                    <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                      <button onClick={() => setReportViewMode('card')} className={`p-2 rounded-lg transition-all ${reportViewMode === 'card' ? 'bg-white text-npk-blue shadow-sm' : 'text-gray-400'}`}><LayoutGrid size={18}/></button>
                      <button onClick={() => setReportViewMode('table')} className={`p-2 rounded-lg transition-all ${reportViewMode === 'table' ? 'bg-white text-npk-blue shadow-sm' : 'text-gray-400'}`}><List size={18}/></button>
                    </div>
                  )}
                  <button onClick={() => exportReportsToExcel(reports)} className="p-3 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors shadow-sm"><Download size={18} /></button>
                  <button onClick={() => excelUploadRef.current?.click()} className="p-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors shadow-sm">
                    <Upload size={18} />
                    <input type="file" ref={excelUploadRef} className="hidden" accept=".xlsx, .xls" onChange={handleExcelUpload} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-20">
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-npk-blue shadow-sm hover:shadow-md transition-all"><p className="text-xs font-black text-gray-500 uppercase mb-2">총 작업 내역</p><h4 className="text-5xl font-black text-black">{stats.totalReports}건</h4></div>
                <div className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-orange-500 shadow-sm hover:shadow-md transition-all"><p className="text-xs font-black text-gray-500 uppercase mb-2">현재 작업 중</p><h4 className="text-5xl font-black text-orange-600">{stats.recentFailures}건</h4></div>
                <div className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-npk-yellow shadow-sm hover:shadow-md transition-all"><p className="text-xs font-black text-gray-500 uppercase mb-2">AI 분석 제공</p><h4 className="text-5xl font-black text-black">{stats.aiAnalyzed}건</h4></div>
              </div>
              <h3 className="text-2xl font-black mb-6 text-npk-dark flex items-center gap-2"><TrendingUp className="text-npk-blue" /> 최근 발생 현황</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {reports.slice(0, 6).map(r => (
                  <DashboardRecentCard key={r.id} r={r} onEdit={handleOpenEdit} onDelete={handleDeleteIndividual} />
                ))}
                {reports.length === 0 && <div className="col-span-full py-20 text-center font-black text-gray-300 uppercase tracking-widest border-2 border-dashed border-gray-200 rounded-[3rem]">데이터가 없습니다.</div>}
              </div>
            </div>
          )}
          {activeTab === 'reports' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredAndSortedReports.map(report => (
                <ReportCard key={report.id} report={report} onDownload={generatePDFReport} onEdit={() => handleOpenEdit(report)} onArchive={handleArchiveReport} onDelete={handleDeleteIndividual} isSelected={selectedIds.has(String(report.id))} onSelect={() => toggleSelect(report.id)} />
              ))}
            </div>
          )}
          {activeTab === 'history' && <TableView data={filteredAndSortedReports} />}
          {activeTab === 'archive' && (
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-250px)] animate-in fade-in">
              <div className="w-full lg:w-80 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                <div className="p-6 bg-gray-50/50"><h3 className="font-black text-npk-dark flex items-center gap-2"><HardHat size={18} /> 설비 리스트</h3><div className="mt-4 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input type="text" placeholder="검색..." className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-npk-blue" value={equipmentSearchTerm} onChange={(e) => setEquipmentSearchTerm(e.target.value)} /></div></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {filteredEquipmentNames.map(name => (
                    <button key={name} onClick={() => setSelectedEquipment(name)} className={`w-full text-left p-4 rounded-2xl flex items-center justify-between transition-all ${selectedEquipment === name ? 'bg-npk-blue text-white shadow-lg' : 'hover:bg-npk-light text-black font-bold'}`}>
                      <div className="flex flex-col"><span className="text-sm truncate max-w-[180px] font-black">{name}</span><span className={`text-[10px] ${selectedEquipment === name ? 'text-white/60' : 'text-gray-400'}`}>{archivedByEquipment[name]?.length || 0}건</span></div><ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                {!selectedEquipment ? <div className="h-full flex flex-col items-center justify-center text-gray-300 uppercase font-black tracking-widest"><Archive size={64} className="mb-4 opacity-10"/>설비를 선택하세요</div> : (
                  <>
                    <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-npk-light/20 shrink-0"><h3 className="text-2xl font-black text-npk-dark">{selectedEquipment} 정비 이력</h3><button onClick={() => setSelectedEquipment(null)} className="p-2 hover:bg-white rounded-full transition-colors"><X size={20}/></button></div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-npk-blue/10">
                      {archivedByEquipment[selectedEquipment]?.map((h) => (
                        <div key={h.id} className="relative pl-10 group"><div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-4 border-npk-blue shadow-sm z-10" />
                          <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 hover:border-npk-blue/30 transition-all shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4"><div className="flex items-center gap-3"><span className="px-3 py-1 bg-npk-blue text-white text-[10px] font-black rounded-lg uppercase">#{h.notificationNo}</span><h4 className="font-black text-black">{h.workDept}</h4></div>
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(h); }} className="p-2 bg-white rounded-xl border border-gray-200 transition-all hover:bg-npk-light"><Edit2 size={16}/></button>
                                <button onClick={(e) => { e.stopPropagation(); generatePDFReport(h); }} className="p-2 bg-white rounded-xl border border-gray-200 transition-all hover:bg-npk-light"><Download size={16}/></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteIndividual(h.id); }} className="p-2 bg-white rounded-xl border border-gray-200 transition-all hover:bg-red-50 text-red-500"><Trash2 size={16}/></button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm font-bold text-black"><div><p className="text-[10px] text-npk-blue uppercase opacity-60 font-black">고장경위</p><p>"{h.workContent}"</p></div><div><p className="text-[10px] text-npk-blue uppercase opacity-60 font-black">고장원인</p><p>{h.cause}</p></div><div><p className="text-[10px] text-npk-blue uppercase opacity-60 font-black">조치사항</p><p>{h.action}</p></div></div>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-[10px] font-black"><button onClick={() => handleArchiveReport(h.id)} className="text-npk-blue hover:underline uppercase tracking-tight">복구하기</button><span className="text-gray-400 font-bold">{h.failDate}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 정비 내용 모달 */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-npk-dark/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl flex flex-col border-4 border-npk-yellow animate-in zoom-in-95 duration-200 overflow-hidden max-h-[95vh]">
            <div className="bg-npk-blue px-8 py-6 flex justify-between items-center text-white shrink-0 shadow-lg">
              <h3 className="text-2xl font-black">{editingIndex !== null ? "정비 내용" : "새 보고서 작성"}</h3>
              <button onClick={() => { setIsFormOpen(false); setEditingIndex(null); }} className="p-2 hover:bg-white/10 rounded-full transition-all hover:rotate-90"><X size={28} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
              <form onSubmit={handleSubmit} className="space-y-6 text-black">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1"><label className="text-[10px] font-black text-npk-blue uppercase tracking-tighter">통지번호</label><input required name="notificationNo" value={formData.notificationNo} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-2 border-transparent focus:border-npk-blue transition-all" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-npk-blue uppercase tracking-tighter">담당부서</label><select name="workDept" value={formData.workDept} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-2 border-transparent focus:border-npk-blue">{['고정', '회전', '계기', '전기', '영선', '공무', '기술'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                  <div className="col-span-2 space-y-1"><label className="text-[10px] font-black text-npk-blue uppercase tracking-tighter">설비명칭</label><input required name="equipmentName" value={formData.equipmentName} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-2 border-transparent focus:border-npk-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-npk-blue uppercase tracking-tighter">발생 날짜</label><input type="date" required name="failDate" value={formData.failDate} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-2 border-transparent focus:border-npk-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-npk-blue uppercase tracking-tighter">발생 시간</label><input type="time" required name="failTime" value={formData.failTime} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-2 border-transparent focus:border-npk-blue" /></div>
                </div>
                <div className="space-y-1"><label className="text-[10px] font-black text-npk-blue uppercase tracking-tighter">고장발생경위</label><textarea required name="workContent" value={formData.workContent} onChange={handleInputChange} rows={2} className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-2 border-transparent focus:border-npk-blue resize-none" /></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1"><label className="text-[10px] font-black text-npk-blue uppercase tracking-tighter">고장 원인</label><textarea required name="cause" value={formData.cause} onChange={handleInputChange} rows={2} className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-2 border-transparent focus:border-npk-blue resize-none" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-npk-blue uppercase tracking-tighter">조치 사항</label><textarea required name="action" value={formData.action} onChange={handleInputChange} rows={2} className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-2 border-transparent focus:border-npk-blue resize-none" /></div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-npk-light/30 rounded-2xl border-2 border-npk-blue/10 transition-all hover:bg-npk-light/50"><input type="checkbox" name="isCompleted" checked={formData.isCompleted} onChange={handleInputChange} className="w-6 h-6 rounded accent-npk-blue cursor-pointer" /><div className="flex flex-col"><label className="text-sm font-black text-black">정비 완료 처리</label><p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Check this if repair is finished</p></div></div>
                
                <div className="flex gap-4">
                  {editingIndex !== null && (
                    <button 
                      type="button" 
                      onClick={() => handleDeleteIndividual(reports[editingIndex].id)}
                      className="px-6 py-5 bg-white border-2 border-red-500 text-red-500 font-black text-xl rounded-2xl transition-all hover:bg-red-50 flex items-center justify-center gap-2 shrink-0"
                    >
                      <Trash2 size={24} />
                      삭제하기
                    </button>
                  )}
                  <button type="submit" disabled={isAnalyzing} className="flex-1 py-5 bg-npk-yellow text-npk-blue font-black text-xl rounded-2xl shadow-xl flex items-center justify-center gap-4 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50">
                    {isAnalyzing ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
                    <span>{isAnalyzing ? "분석 및 저장 중..." : "저장 및 AI 분석"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <footer className="mt-auto py-8 text-center text-gray-400 text-xs font-black uppercase tracking-widest border-t border-gray-100">&copy; 2024 NPK MAINTENANCE SYSTEM</footer>
    </div>
  );
};

export default App;
