
import * as XLSX from 'xlsx';
import { MaintenanceReport } from '../types.ts';

export const exportReportsToExcel = (reports: MaintenanceReport[]) => {
  const data = reports.map(r => ({
    '통지번호': r.notificationNo,
    '부서': r.workDept,
    '설비': r.equipmentName,
    '날짜': r.failDate,
    '상태': r.isCompleted ? '완료' : '진행중'
  }));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "정비이력");
  XLSX.writeFile(workbook, `Maintenance_${Date.now()}.xlsx`);
};

export const downloadExcelTemplate = () => {
  const template = [{ '통지번호': 'N-001', '작업부서': '공무', '설비명칭': 'PUMP-01', '발생날짜': '20240501', '발생시간': '10:00', '고장발생경위': '소음', '고장원인': '베어링', '조치사항': '교체', '조치상태': '완료' }];
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "Upload_Template.xlsx");
};

export const parseReportsFromExcel = async (file: File): Promise<Partial<MaintenanceReport>[]> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      resolve(json.map(row => ({
        notificationNo: String(row['통지번호'] || ''),
        workDept: String(row['작업부서'] || '공무'),
        equipmentName: String(row['설비명칭'] || ''),
        failDate: String(row['발생날짜'] || ''),
        failTime: String(row['발생시간'] || ''),
        workContent: String(row['고장발생경위'] || ''),
        cause: String(row['고장원인'] || ''),
        action: String(row['조치사항'] || ''),
        isCompleted: String(row['조치상태'] || '').includes('완료'),
        createdAt: new Date().toLocaleDateString('ko-KR')
      })));
    };
    reader.readAsBinaryString(file);
  });
};
