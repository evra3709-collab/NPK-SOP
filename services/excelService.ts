
import * as XLSX from 'xlsx';
import { MaintenanceReport } from '../types';

/**
 * 정비 보고서 데이터를 Excel 파일로 내보냅니다.
 */
export const exportReportsToExcel = (reports: MaintenanceReport[]) => {
  const data = reports.map((r, index) => ({
    '순번': reports.length - index,
    '통지번호': r.notificationNo,
    '작업부서': r.workDept,
    '설비명칭': r.equipmentName,
    '발생날짜': r.failDate,
    '발생시간': r.failTime,
    '고장발생경위': r.workContent,
    '고장원인': r.cause,
    '조치사항': r.action,
    '조치상태': r.isCompleted ? '완료' : '진행중',
    '등록일시': r.createdAt
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "정비이력");
  
  // 파일 다운로드 실행
  XLSX.writeFile(workbook, `NPK_정비이력_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Excel 업로드를 위한 표준 양식 파일을 다운로드합니다.
 */
export const downloadExcelTemplate = () => {
  const templateData = [
    {
      '통지번호': '예: N-2024-001',
      '작업부서': '공무',
      '설비명칭': '예: 메인 펌프 P-101',
      '발생날짜': '20240510',
      '발생시간': '14:30',
      '고장발생경위': '운전 중 이상 소음 및 진동 발생',
      '고장원인': '베어링 하우징 마모',
      '조치사항': '베어링 교체 및 구리스 주입',
      '조치상태': '완료'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "업로드양식");
  
  // 컬럼 너비 자동 조정
  const wscols = [
    { wch: 15 }, // 통지번호
    { wch: 15 }, // 작업부서
    { wch: 30 }, // 설비명칭
    { wch: 15 }, // 발생날짜
    { wch: 10 }, // 발생시간
    { wch: 50 }, // 고장발생경위
    { wch: 40 }, // 고장원인
    { wch: 40 }, // 조치사항
    { wch: 15 }, // 조치상태
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, "NPK_정비보고서_일괄업로드_양식.xlsx");
};

/**
 * Excel 파일을 읽어 정비 보고서 객체 배열로 변환합니다.
 * cellDates: true를 사용하여 엑셀의 날짜 형식을 JS Date로 변환합니다.
 */
export const parseReportsFromExcel = async (file: File): Promise<Partial<MaintenanceReport>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // cellDates: true를 설정하여 숫자형 날짜를 실제 날짜 객체로 읽어옵니다.
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // 전체 데이터를 읽어온 후, 2번째 행(첫 번째 데이터 행 - 예시 데이터)을 제외하기 위해 slice(1) 사용
        const json: any[] = XLSX.utils.sheet_to_json(sheet);
        const dataRows = json.length > 1 ? json.slice(1) : json; 
        // 만약 데이터가 1개뿐이라면 사용자가 예시를 지우고 썼을 가능성이 높으므로 그대로 사용, 
        // 2개 이상이면 첫 번째(예시 행)를 제외함.
        
        const reports: Partial<MaintenanceReport>[] = dataRows.map(row => {
          // 날짜 처리 함수 (YYYY-MM-DD 및 YYYYMMDD 대응)
          const formatDate = (val: any) => {
            if (val instanceof Date) {
               // 타임존 보정 (UTC -> 로컬)
               const offset = val.getTimezoneOffset() * 60000;
               const localDate = new Date(val.getTime() - offset);
               return localDate.toISOString().slice(0, 10);
            }
            
            const strVal = String(val || '').trim();
            
            // 8자리 숫자 형태 (YYYYMMDD) 체크
            if (/^\d{8}$/.test(strVal)) {
              return `${strVal.substring(0, 4)}-${strVal.substring(4, 6)}-${strVal.substring(6, 8)}`;
            }

            if (typeof val === 'number') {
               // 엑셀 날짜 시리얼 번호 처리 (예: 45422)
               if (val < 100000) {
                 return new Date(Math.round((val - 25569) * 864e5)).toISOString().slice(0, 10);
               }
               // 만약 숫자가 20240510 처럼 큰 숫자라면 YYYYMMDD로 처리
               const s = String(val);
               if (s.length === 8) {
                 return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
               }
            }
            return strVal;
          };

          // 시간 처리 함수
          const formatTime = (val: any) => {
            if (val instanceof Date) {
               const h = val.getHours().toString().padStart(2, '0');
               const m = val.getMinutes().toString().padStart(2, '0');
               return `${h}:${m}`;
            }
            return String(val || '00:00').trim();
          };

          return {
            notificationNo: String(row['통지번호'] || '').trim(),
            workDept: String(row['작업부서'] || '공무').split(' ')[0], 
            equipmentName: String(row['설비명칭'] || '').trim(),
            failDate: formatDate(row['발생날짜']) || new Date().toISOString().slice(0, 10),
            failTime: formatTime(row['발생시간']),
            workContent: String(row['고장발생경위'] || '').trim(),
            cause: String(row['고장원인'] || '').trim(),
            action: String(row['조치사항'] || '').trim(),
            isCompleted: String(row['조치상태'] || '').includes('완료'),
            createdAt: new Date().toLocaleDateString('ko-KR'),
          };
        });

        resolve(reports);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
