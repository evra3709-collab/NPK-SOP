
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getMaintenanceAdvice = async (equipment: string, cause: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `당신은 20년 경력의 베테랑 산업 유지보수 엔지니어입니다. 다음 고장 사례에 대해 전문가 수준의 분석과 '단계별 해결 가이드'를 작성하세요.
      
      [분석 대상]
      설비명: ${equipment}
      보고된 원인: ${cause}
      
      [작성 가이드라인]
      1. '원인 분석'과 '권고 조치' 두 섹션으로 나누어 작성하세요.
      2. 권고 조치는 1, 2, 3 단계별로 구체적인 행동(Action)을 제시하세요.
      3. 답변은 반드시 한국어로 작성하며 총 300자 이내로 간결하면서도 전문적으로 작성하세요.
      4. 현장 엔지니어가 즉시 참고할 수 있는 실질적인 팁을 포함하세요.`,
      config: {
        temperature: 0.6,
        topP: 0.9,
      },
    });

    return response.text || "현재 분석 정보를 생성할 수 없습니다.";
  } catch (error) {
    console.error("Gemini API 오류:", error);
    return "AI 통찰력을 생성하는 중 오류가 발생했습니다. 연결 상태를 확인하세요.";
  }
};
