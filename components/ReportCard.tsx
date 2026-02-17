
import React, { useState } from 'react';
import { MaintenanceReport } from '../types';
import { 
  Calendar, 
  Clock, 
  Wrench, 
  Download, 
  Cpu, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Edit2,
  CheckSquare,
  Square,
  Archive,
  RefreshCcw,
  Trash2
} from 'lucide-react';

interface ReportCardProps {
  report: MaintenanceReport;
  onDownload: (report: MaintenanceReport) => Promise<void>;
  onEdit: () => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
  onSelect?: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ report, onDownload, onEdit, onArchive, onDelete, isSelected, onSelect }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    await onDownload(report);
    setIsDownloading(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 중복 확인창을 피하기 위해 App.tsx의 onDelete만 호출합니다.
    onDelete(String(report.id));
  };

  return (
    <div className={`bg-white border-2 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group relative flex flex-col h-full ${isSelected ? 'border-npk-yellow ring-4 ring-npk-yellow/10' : 'border-gray-100 hover:border-npk-blue/30'}`}>
      {/* 선택 체크박스 */}
      <button 
        onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
        className="absolute top-5 left-5 z-10 p-1.5 rounded-lg bg-white/80 backdrop-blur shadow-sm border border-gray-100 text-npk-blue hover:scale-105 transition-transform"
      >
        {isSelected ? <CheckSquare size={18} className="text-npk-yellow fill-npk-blue" /> : <Square size={18} className="text-gray-300" />}
      </button>

      <div className="p-6 pt-14 flex-1 flex flex-col">
        {/* 상단 헤더 영역 */}
        <div className="flex items-start justify-between mb-5 gap-3">
          <div className="flex-1 min-w-0 flex items-start space-x-3">
            <div className={`p-3 rounded-2xl transition-colors shrink-0 ${isSelected ? 'bg-npk-yellow text-npk-blue' : 'bg-npk-light text-npk-blue group-hover:bg-npk-blue group-hover:text-white'}`}>
              <Wrench size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col">
                <h3 className="text-lg font-black text-black leading-tight truncate pr-1" title={report.equipmentName}>
                  {report.equipmentName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-npk-blue text-white text-[9px] font-bold rounded uppercase tracking-wide whitespace-nowrap">
                    {report.workDept}
                  </span>
                  <p className="text-[10px] text-gray-400 font-mono tracking-tight uppercase font-bold">
                    ID: {report.notificationNo || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* 액션 버튼 그룹 */}
          <div className="flex items-center space-x-1 shrink-0 relative z-20 pt-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-2 bg-gray-50 text-black rounded-xl hover:bg-npk-yellow hover:text-npk-blue transition-all border border-gray-100"
              title="수정"
            >
              <Edit2 size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onArchive(report.id); }}
              className={`p-2 rounded-xl transition-all border border-gray-100 ${report.isArchived ? 'bg-blue-50 text-npk-blue hover:bg-blue-100' : 'bg-gray-50 text-black hover:bg-npk-dark hover:text-white'}`}
              title={report.isArchived ? "복구하기" : "보관하기"}
            >
              {report.isArchived ? <RefreshCcw size={14} /> : <Archive size={14} />}
            </button>
            <button 
              onClick={handleDeleteClick}
              className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-red-100"
              title="삭제"
            >
              <Trash2 size={14} />
            </button>
            <button 
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center space-x-1 px-2.5 py-2 bg-npk-blue text-white rounded-xl text-[10px] font-black hover:bg-npk-dark transition-all disabled:opacity-50 shadow-sm"
            >
              {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* 일시 정보 */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="flex items-center space-x-2 text-[11px] font-black text-black bg-npk-light/40 p-2 rounded-xl border border-npk-light/30">
            <Calendar size={13} className="shrink-0 text-npk-blue" />
            <span className="truncate">{report.failDate}</span>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-black text-black bg-npk-light/40 p-2 rounded-xl border border-npk-light/30">
            <Clock size={13} className="shrink-0 text-npk-blue" />
            <span className="truncate">{report.failTime}</span>
          </div>
        </div>

        {/* 고장 내용 */}
        <div className="space-y-4 flex-1">
          <div>
            <div className="flex items-center space-x-1.5 mb-1">
              <AlertCircle size={13} className="text-npk-blue" />
              <span className="text-[9px] font-black uppercase tracking-widest text-npk-blue">고장발생경위</span>
            </div>
            <p className="text-sm text-black leading-snug font-bold italic px-1 break-all line-clamp-3">
              "{report.workContent}"
            </p>
          </div>
          
          {/* AI 인사이트 */}
          {report.aiInsights && (
            <div className={`rounded-2xl border-2 transition-all duration-300 ${isExpanded ? 'bg-npk-light/30 border-npk-blue/20' : 'bg-yellow-50/50 border-npk-yellow/20'}`}>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="w-full flex items-center justify-between p-3 focus:outline-none"
              >
                <div className="flex items-center space-x-2 text-npk-blue">
                  <Cpu size={14} className="text-npk-yellow fill-npk-blue" />
                  <span className="text-[10px] font-black uppercase tracking-tight">AI 기술 권고</span>
                </div>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100 border-t border-npk-blue/5' : 'max-h-0 opacity-0'}`}>
                <div className="p-3">
                  <p className="text-[13px] text-black leading-relaxed whitespace-pre-wrap font-bold break-all">
                    {report.aiInsights}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 푸터 영역 */}
      <div className={`px-6 py-3 border-t-2 flex justify-between items-center transition-colors ${isSelected ? 'bg-npk-yellow/5 border-npk-yellow/10' : 'bg-gray-50/50 border-gray-50'}`}>
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">생성: {report.createdAt}</span>
        <div className="flex items-center space-x-1.5">
          <div className={`w-2 h-2 rounded-full ${report.isCompleted ? 'bg-green-500 shadow-sm shadow-green-200' : 'bg-orange-500 animate-pulse'}`}></div>
          <span className={`text-[10px] font-black uppercase tracking-tight ${report.isCompleted ? 'text-green-700' : 'text-orange-700'}`}>
            {report.isCompleted ? '조치 완료' : '조치 진행중'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReportCard;
