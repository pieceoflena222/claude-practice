/* =========================================================
   3분 AI 업무활용 스타일 진단 - script.js
   순수 자바스크립트로만 구현 (외부 라이브러리/프레임워크 없음)
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     1. 데이터 정의
     - 문항, 역량, 스타일 관련 데이터는 모두 이곳에서 관리합니다.
     - 문항 내용이나 문구를 수정할 때는 questionsData 배열만
       수정하면 됩니다. (화면 HTML은 건드릴 필요 없음)
  --------------------------------------------------------- */

  // 5가지 AI 업무활용 역량 메타 정보 (표시 순서 = 이 배열 순서)
  const competencyMeta = [
    { key: "정의력", label: "업무정의력", emoji: "🎯" },
    { key: "설계력", label: "요청설계력", emoji: "💬" },
    { key: "검증력", label: "결과검증력", emoji: "🔎" },
    { key: "보안감각", label: "보안감각", emoji: "🔐" },
    { key: "확장력", label: "확장활용력", emoji: "⚙️" },
  ];

  // 12개 문항 데이터 (질문 하나당 선택지 4개)
  // competency: 이 문항이 측정하는 역량 key
  // score: 해당 선택지를 골랐을 때 획득하는 역량 점수(0~4점 척도)
  // style: 해당 선택지가 대응되는 활용 스타일 key
  const questionsData = [
    {
      id: 1,
      competency: "정의력",
      text: "팀장님이 자료 3개를 주면서\n“핵심만 정리해서 보고해 주세요.”라고 했습니다.\n나는 가장 먼저 어떻게 할까요?",
      options: [
        { key: "A", text: "자료를 모두 AI에 넣고 “핵심 내용 요약해줘”라고 요청한다.", score: 2, style: "실행가" },
        { key: "B", text: "누가 볼 보고서인지, 무엇을 판단하기 위한 것인지 먼저 정리한 뒤 AI에 요청한다.", score: 4, style: "설계자" },
        { key: "C", text: "자료의 중요한 부분을 먼저 직접 확인한 후 AI에게 정리를 요청한다.", score: 3, style: "검증가" },
        { key: "D", text: "여러 AI에 같은 자료를 넣어 결과를 비교해본다.", score: 2, style: "탐험가" },
      ],
    },
    {
      id: 2,
      competency: "설계력",
      text: "AI에게 업무를 요청했는데 결과가 너무 일반적입니다.\n나는 어떻게 할까요?",
      options: [
        { key: "A", text: "다른 AI 서비스에서도 같은 질문을 해본다.", score: 2, style: "탐험가" },
        { key: "B", text: "원하는 결과의 예시를 보여주고 그 형식에 맞춰 다시 요청한다.", score: 4, style: "설계자" },
        { key: "C", text: "“좀 더 자세히 작성해줘.”라고 다시 요청한다.", score: 1, style: "실행가" },
        { key: "D", text: "업무 목적, 대상, 조건, 결과 형식을 추가해 다시 요청한다.", score: 4, style: "설계자" },
      ],
    },
    {
      id: 3,
      competency: "검증력",
      text: "AI가 보고서에 중요한 통계 수치를 하나 제시했습니다.\n가장 가까운 행동은?",
      options: [
        { key: "A", text: "문장이 자연스럽고 그럴듯하면 그대로 사용한다.", score: 1, style: "실행가" },
        { key: "B", text: "AI에게 “이 수치의 출처가 뭐야?”라고 다시 질문한다.", score: 2, style: "탐험가" },
        { key: "C", text: "원자료나 공식 출처에서 해당 수치를 직접 확인한다.", score: 4, style: "검증가" },
        { key: "D", text: "정확성이 걱정된다면 해당 수치를 빼고 작성한다.", score: 3, style: "검증가" },
      ],
    },
    {
      id: 4,
      competency: "보안감각",
      text: "내부 업무자료를 AI로 분석해야 하는 상황입니다.\n가장 가까운 행동은?",
      options: [
        { key: "A", text: "먼저 기관의 AI 이용규정과 사용 가능한 도구인지 확인한다.", score: 4, style: "검증가" },
        { key: "B", text: "업무가 급하면 우선 파일 전체를 AI에 업로드한다.", score: 1, style: "실행가" },
        { key: "C", text: "개인정보나 불필요한 민감정보를 제거하고 허용된 환경에서 필요한 내용만 사용한다.", score: 4, style: "설계자" },
        { key: "D", text: "조금이라도 민감한 자료라면 AI는 전혀 사용하지 않는다.", score: 3, style: "검증가" },
      ],
    },
    {
      id: 5,
      competency: "확장력",
      text: "매주 비슷한 형식의 보고서를 반복해서 작성합니다.\n나는 AI를 어떻게 활용할까요?",
      options: [
        { key: "A", text: "매주 필요한 내용을 그때그때 AI에게 질문한다.", score: 2, style: "실행가" },
        { key: "B", text: "보고서 작성 절차와 프롬프트를 템플릿으로 만들어 반복해서 사용한다.", score: 4, style: "설계자" },
        { key: "C", text: "매번 새로운 AI 도구를 찾아 더 좋은 방법이 있는지 시험해본다.", score: 2, style: "탐험가" },
        { key: "D", text: "중요한 보고서는 품질이 걱정되므로 가급적 직접 작성한다.", score: 3, style: "검증가" },
      ],
    },
    {
      id: 6,
      competency: "정의력",
      text: "갑자기 처음 해보는 업무를 맡았는데\n요청사항이 명확하지 않습니다.\n가장 먼저 하는 행동은?",
      options: [
        { key: "A", text: "우선 AI에게 초안을 만들어달라고 하고 결과를 보면서 생각한다.", score: 2, style: "실행가" },
        { key: "B", text: "업무의 목적, 대상, 마감일, 필요한 결과를 먼저 확인한다.", score: 4, style: "설계자" },
        { key: "C", text: "비슷한 업무 사례부터 AI로 찾아본다.", score: 3, style: "탐험가" },
        { key: "D", text: "확실하지 않은 부분을 구분해두고 가능한 범위에서 먼저 정리한다.", score: 3, style: "균형가" },
      ],
    },
    {
      id: 7,
      competency: "설계력",
      text: "AI의 결과를 한 단계 더 좋게 만들고 싶습니다.\n나는 주로 어떻게 요청할까요?",
      options: [
        { key: "A", text: "처음보다 훨씬 긴 프롬프트를 작성한다.", score: 2, style: "실행가" },
        { key: "B", text: "역할, 상황, 목적, 조건, 출력형식을 구조화해서 요청한다.", score: 4, style: "설계자" },
        { key: "C", text: "인터넷에서 유명한 프롬프트를 찾아 그대로 사용한다.", score: 2, style: "탐험가" },
        { key: "D", text: "AI가 만든 결과에서 부족한 점을 구체적으로 알려주고 수정하게 한다.", score: 4, style: "균형가" },
      ],
    },
    {
      id: 8,
      competency: "검증력",
      text: "AI가 요약한 내용과 원문 내용이 조금 다른 것 같습니다.\n나는 어떻게 할까요?",
      options: [
        { key: "A", text: "AI가 전체 내용을 읽었으니 크게 문제없을 것이라고 생각한다.", score: 1, style: "실행가" },
        { key: "B", text: "원문과 AI 요약을 비교해 다른 부분을 직접 확인한다.", score: 4, style: "검증가" },
        { key: "C", text: "다른 AI에게 어느 쪽이 맞는지 물어본다.", score: 2, style: "탐험가" },
        { key: "D", text: "불일치하는 부분을 표시한 뒤 원자료를 기준으로 최종 판단한다.", score: 4, style: "균형가" },
      ],
    },
    {
      id: 9,
      competency: "보안감각",
      text: "회의록에 직원 이름, 연락처, 내부 업무내용 등이\n포함되어 있습니다. AI로 정리해야 한다면?",
      options: [
        { key: "A", text: "회의록 전체를 그대로 업로드한다.", score: 1, style: "실행가" },
        { key: "B", text: "분석에 필요하지 않은 개인정보를 제거하거나 비식별화한 후 사용한다.", score: 4, style: "설계자" },
        { key: "C", text: "민감한 내용이 있을 수 있으므로 AI를 사용하지 않는다.", score: 3, style: "검증가" },
        { key: "D", text: "기관에서 허용한 AI 환경인지 먼저 확인한 후 규정 범위에서 사용한다.", score: 4, style: "검증가" },
      ],
    },
    {
      id: 10,
      competency: "확장력",
      text: "매달 같은 엑셀 데이터를 이용해 비슷한 보고서를\n작성합니다. 나는 어떻게 할까요?",
      options: [
        { key: "A", text: "매달 새로운 대화창을 열어 AI에게 다시 요청한다.", score: 2, style: "실행가" },
        { key: "B", text: "데이터 정리 → 분석 → 보고서 작성 과정을 정형화하고 반복 가능한 방법으로 만든다.", score: 4, style: "설계자" },
        { key: "C", text: "엑셀 함수나 기존 업무도구만으로 해결할 방법을 먼저 찾아본다.", score: 3, style: "균형가" },
        { key: "D", text: "더 좋은 AI 도구가 있는지 여러 서비스를 시험해본다.", score: 2, style: "탐험가" },
      ],
    },
    {
      id: 11,
      competency: "정의력",
      text: "여러 AI 도구 중 어떤 것을 써야 할지 고민됩니다.\n나는 어떤 기준으로 선택할까요?",
      options: [
        { key: "A", text: "요즘 가장 유명한 AI를 사용한다.", score: 2, style: "탐험가" },
        { key: "B", text: "업무 목적, 데이터 유형, 보안, 필요한 결과를 기준으로 도구를 선택한다.", score: 4, style: "설계자" },
        { key: "C", text: "평소 가장 익숙한 AI를 사용한다.", score: 3, style: "실행가" },
        { key: "D", text: "간단한 샘플 업무를 여러 AI에서 시험한 후 가장 적합한 것을 선택한다.", score: 4, style: "균형가" },
      ],
    },
    {
      id: 12,
      competency: "검증력",
      text: "AI로 중요한 업무 결과물을 완성했습니다.\n제출하기 전에 나는?",
      options: [
        { key: "A", text: "AI가 잘 작성했으므로 그대로 제출한다.", score: 1, style: "실행가" },
        { key: "B", text: "맞춤법과 문장 정도만 확인한다.", score: 2, style: "실행가" },
        { key: "C", text: "사실관계, 근거, 보안, 대상, 표현을 확인하고 최종 수정한다.", score: 4, style: "검증가" },
        { key: "D", text: "AI에게 한 번 더 자체 검토를 시킨 후 내가 마지막으로 확인한다.", score: 3, style: "균형가" },
      ],
    },
  ];

  // AI 업무활용 스타일 5종 메타 정보
  const styleMeta = {
    실행가: {
      emoji: "⚡",
      name: "AI 실행가",
      tagline: "일단 AI와 함께 시작하고 결과를 빠르게 만드는 타입",
      strengths: [
        "실행 속도가 빠릅니다.",
        "AI 사용에 대한 거부감이 적습니다.",
        "초안 작성과 아이디어 생산에 강합니다.",
      ],
      caution: "빠르게 결과를 얻는 만큼 검증이나 업무 목적 설정을 건너뛸 수 있습니다.",
      growthTip: "AI에게 답을 받는 것에서 끝내지 말고, 그 답이 맞는지 판단하는 습관을 더해보세요.",
    },
    탐험가: {
      emoji: "🧭",
      name: "AI 탐험가",
      tagline: "새로운 AI와 새로운 방법을 발견하는 것을 즐기는 타입",
      strengths: [
        "새로운 도구에 대한 적응이 빠릅니다.",
        "다양한 AI 활용방법을 시도합니다.",
        "변화에 대한 수용성이 높습니다.",
      ],
      caution: "도구 탐색 자체가 목적이 되면 실제 업무성과와 연결되지 않을 수 있습니다.",
      growthTip: "어떤 AI가 좋은가보다 지금 업무에 어떤 AI가 필요한가를 먼저 생각해보세요.",
    },
    검증가: {
      emoji: "🔎",
      name: "AI 검증가",
      tagline: "AI의 답보다 근거와 정확성을 한 번 더 확인하는 타입",
      strengths: [
        "결과의 신뢰도를 중요하게 생각합니다.",
        "사실과 근거 확인에 강합니다.",
        "보안과 위험요소에 민감합니다.",
      ],
      caution: "신중함이 지나치면 AI가 줄 수 있는 생산성 향상을 충분히 활용하지 못할 수 있습니다.",
      growthTip: "검증의 강점을 유지하면서 반복 가능한 업무는 AI에게 더 과감하게 맡겨보세요.",
    },
    설계자: {
      emoji: "🛠️",
      name: "AI 설계자",
      tagline: "AI에게 일을 시키는 것을 넘어 일하는 방법 자체를 설계하는 타입",
      strengths: [
        "업무 목적과 결과물을 구조화합니다.",
        "좋은 프롬프트와 템플릿 활용에 강합니다.",
        "반복 업무를 효율화하는 능력이 높습니다.",
      ],
      caution: "간단한 업무까지 지나치게 복잡한 구조로 만들 수 있습니다.",
      growthTip: "업무의 중요도에 따라 단순 질문과 체계적인 워크플로를 적절히 구분해보세요.",
    },
    균형가: {
      emoji: "⚖️",
      name: "AI 균형가",
      tagline: "속도와 정확성, AI와 사람의 역할을 균형 있게 조율하는 타입",
      strengths: [
        "업무 상황에 따라 다양한 방법을 선택합니다.",
        "AI 결과와 인간의 판단을 함께 활용합니다.",
        "특정 도구나 방식에 지나치게 의존하지 않습니다.",
      ],
      caution: "여러 요소를 고려하다 보면 실행 속도가 늦어질 수 있습니다.",
      growthTip: "반복되는 업무에서는 자신만의 AI 활용 패턴을 만들어 실행력을 더 높여보세요.",
    },
  };

  // 역량별 "나의 강점" 안내 문구 (점수가 높을 때 보여줄 문구)
  const strengthCopy = {
    정의력: "AI에게 바로 질문하기보다 무엇을 해결해야 하는지 먼저 생각하는 강점이 있습니다.",
    설계력: "AI에게 상황과 목적, 원하는 결과 형식을 구체적으로 전달하는 강점이 있습니다.",
    검증력: "AI가 만든 결과를 그대로 믿지 않고 근거와 출처를 확인하는 강점이 있습니다.",
    보안감각: "AI 활용 시 정보의 민감도와 사용환경을 비교적 잘 고려하고 있습니다.",
    확장력: "한 번의 업무 경험을 템플릿과 반복 가능한 방식으로 확장하는 강점이 있습니다.",
  };

  // 역량별 "한 단계 성장하려면" 안내 문구 (가장 낮은 역량 1개에 노출)
  const growthCopy = {
    정의력: "AI를 열기 전에 “누구를 위해, 무엇을 만들고, 어디에 사용할 것인가?” 세 가지를 먼저 정리해보세요.",
    설계력: "AI에게 질문할 때 상황 + 목적 + 조건 + 원하는 결과형식, 네 가지를 함께 전달해보세요.",
    검증력: "AI의 답을 바로 사용하는 대신 원문·데이터·공식 출처 중 하나를 반드시 다시 확인하는 습관을 만들어보세요.",
    보안감각: "AI에 자료를 넣기 전에 “이 정보가 외부 서비스에 입력되어도 되는가?” 한 번 확인해보세요.",
    확장력: "잘 만든 프롬프트를 한 번 쓰고 버리지 말고 템플릿으로 저장해 반복업무에 재사용해보세요.",
  };

  // 역량별 "오늘 교육에서 집중" 안내 문구 (가장 낮은 역량 2개에 노출)
  const focusCopy = {
    정의력: "AI에게 질문하기 전에 업무를 구조화하는 방법",
    설계력: "AI가 제대로 일하도록 요청을 설계하는 방법",
    검증력: "AI의 오류와 환각을 발견하고 결과를 검증하는 방법",
    보안감각: "업무자료를 안전하게 AI와 활용하는 방법",
    확장력: "한 번의 질문을 반복 가능한 AI 업무방식으로 만드는 방법",
  };

  // 전체 점수 구간별 해석
  const scoreBands = [
    {
      min: 0,
      max: 39,
      title: "AI 시작 단계",
      desc: "AI 활용을 시작하고 있는 단계입니다. 도구 자체보다 업무 목적을 정하고 결과를 확인하는 기본 습관부터 익혀보세요.",
    },
    {
      min: 40,
      max: 59,
      title: "AI 활용 성장 단계",
      desc: "AI를 업무에 활용하고 있지만 상황에 따라 활용 수준의 편차가 있습니다. 좋은 요청과 결과 검증 습관을 더하면 활용도가 크게 높아질 수 있습니다.",
    },
    {
      min: 60,
      max: 79,
      title: "AI 실무활용 단계",
      desc: "AI를 실제 업무에 비교적 잘 연결하고 있습니다. 이제 반복업무를 템플릿과 워크플로로 확장하면 생산성을 더 높일 수 있습니다.",
    },
    {
      min: 80,
      max: 100,
      title: "AI 전략활용 단계",
      desc: "업무 목적, 요청 설계, 검증, 보안, 확장 활용을 균형 있게 고려하고 있습니다. 단순 사용을 넘어 AI를 업무 프로세스에 설계하는 단계로 발전해볼 수 있습니다.",
    },
  ];

  const TOTAL_QUESTIONS = questionsData.length;
  const STORAGE_KEY = "aiWorkstyleCheck.lastResult";

  /* ---------------------------------------------------------
     2. 상태 관리
  --------------------------------------------------------- */

  const state = {
    currentIndex: 0, // 현재 보여지는 문항 인덱스 (0-based)
    answers: new Array(TOTAL_QUESTIONS).fill(null), // 사용자가 고른 선택 정보 저장
  };

  /* ---------------------------------------------------------
     3. DOM 참조
  --------------------------------------------------------- */

  const el = {
    screenStart: document.getElementById("screen-start"),
    screenQuiz: document.getElementById("screen-quiz"),
    screenResult: document.getElementById("screen-result"),

    btnStart: document.getElementById("btn-start"),
    prevResultHint: document.getElementById("prev-result-hint"),

    btnPrev: document.getElementById("btn-prev"),
    progressCurrent: document.getElementById("progress-current"),
    progressFill: document.getElementById("progress-fill"),
    progressTrack: document.getElementById("progress-track"),
    quizCard: document.getElementById("quiz-card"),
    questionEyebrow: document.getElementById("question-eyebrow"),
    questionText: document.getElementById("question-text"),
    optionsList: document.getElementById("options-list"),

    styleEmoji: document.getElementById("style-emoji"),
    styleName: document.getElementById("style-name"),
    styleTagline: document.getElementById("style-tagline"),
    scoreNumber: document.getElementById("score-number"),
    scoreStage: document.getElementById("score-stage"),
    scoreStageDesc: document.getElementById("score-stage-desc"),
    competencyList: document.getElementById("competency-list"),
    strengthList: document.getElementById("strength-list"),
    growthList: document.getElementById("growth-list"),
    focusList: document.getElementById("focus-list"),
    compareBlock: document.getElementById("compare-block"),
    compareValue: document.getElementById("compare-value"),

    btnCopy: document.getElementById("btn-copy"),
    btnRestart: document.getElementById("btn-restart"),

    toast: document.getElementById("toast"),
  };

  let advanceTimer = null;
  let toastTimer = null;

  /* ---------------------------------------------------------
     4. 화면 전환 유틸
  --------------------------------------------------------- */

  function showScreen(target) {
    [el.screenStart, el.screenQuiz, el.screenResult].forEach((screen) => {
      const isTarget = screen === target;
      screen.classList.toggle("is-active", isTarget);
      screen.setAttribute("aria-hidden", isTarget ? "false" : "true");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("is-visible");
    }, 2200);
  }

  /* ---------------------------------------------------------
     5. 진단 진행 (문항 렌더링 / 이동)
  --------------------------------------------------------- */

  // 현재 인덱스에 해당하는 문항을 화면에 그려줍니다.
  function renderQuestion() {
    const index = state.currentIndex;
    const question = questionsData[index];
    const savedAnswer = state.answers[index];

    // 상단 진행 표시
    el.progressCurrent.textContent = String(index + 1).padStart(2, "0");
    const percent = Math.round(((index + 1) / TOTAL_QUESTIONS) * 100);
    el.progressFill.style.width = percent + "%";
    el.progressTrack.setAttribute("aria-valuenow", String(percent));

    // 이전 버튼 활성/비활성
    el.btnPrev.disabled = index === 0;

    // 질문 텍스트
    const competency = competencyMeta.find((c) => c.key === question.competency);
    el.questionEyebrow.textContent = `업무 상황 ${index + 1}`;
    el.questionText.textContent = question.text;

    // 선택지 렌더링
    el.optionsList.innerHTML = "";
    question.options.forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.setAttribute("data-option-key", option.key);
      btn.setAttribute(
        "aria-label",
        `선택지 ${option.key}. ${option.text}`
      );

      const keyBadge = document.createElement("span");
      keyBadge.className = "option-key";
      keyBadge.setAttribute("aria-hidden", "true");
      keyBadge.textContent = option.key;

      const textSpan = document.createElement("span");
      textSpan.className = "option-text";
      textSpan.textContent = option.text;

      btn.appendChild(keyBadge);
      btn.appendChild(textSpan);

      // 이전에 선택했던 값이 있다면 표시해줍니다.
      if (savedAnswer && savedAnswer.optionKey === option.key) {
        btn.classList.add("is-selected");
      }

      btn.addEventListener("click", () => selectAnswer(index, option, btn));
      el.optionsList.appendChild(btn);
    });

    // 카드 등장 애니메이션 재생을 위해 리플로우 트리거
    el.quizCard.classList.remove("card-enter");
    void el.quizCard.offsetWidth;
    el.quizCard.classList.add("card-enter");
  }

  // 사용자가 선택지를 클릭했을 때 처리
  function selectAnswer(questionIndex, option, buttonEl) {
    // 이미 자동 이동이 예약되어 있다면 취소 (중복 클릭 방지)
    clearTimeout(advanceTimer);

    // 선택값 저장
    state.answers[questionIndex] = {
      questionId: questionsData[questionIndex].id,
      competency: questionsData[questionIndex].competency,
      optionKey: option.key,
      score: option.score,
      style: option.style,
    };

    // 선택 시각 효과: 고른 버튼 강조, 나머지는 흐리게 + 버튼 비활성화
    const buttons = Array.from(el.optionsList.querySelectorAll(".option-btn"));
    buttons.forEach((btn) => {
      btn.disabled = true;
      if (btn === buttonEl) {
        btn.classList.add("is-selected");
      } else {
        btn.classList.add("is-dimmed");
      }
    });

    // 잠깐의 피드백 후 다음 문항(또는 결과)으로 자연스럽게 이동
    advanceTimer = setTimeout(() => {
      goToNextStep();
    }, 420);
  }

  function goToNextStep() {
    if (state.currentIndex < TOTAL_QUESTIONS - 1) {
      state.currentIndex += 1;
      renderQuestion();
    } else {
      finishQuiz();
    }
  }

  function goToPrevQuestion() {
    if (state.currentIndex === 0) return;
    clearTimeout(advanceTimer);
    state.currentIndex -= 1;
    renderQuestion();
  }

  function startTest() {
    state.currentIndex = 0;
    state.answers = new Array(TOTAL_QUESTIONS).fill(null);
    showScreen(el.screenQuiz);
    renderQuestion();
  }

  /* ---------------------------------------------------------
     6. 채점 로직
  --------------------------------------------------------- */

  // 역량별 획득 점수 / 만점을 계산해 0~100점으로 환산합니다.
  function calculateCompetencyScores() {
    const totals = {};
    competencyMeta.forEach((c) => {
      totals[c.key] = { earned: 0, max: 0 };
    });

    questionsData.forEach((question, index) => {
      const maxForQuestion = Math.max(...question.options.map((o) => o.score));
      totals[question.competency].max += maxForQuestion;

      const answer = state.answers[index];
      if (answer) {
        totals[question.competency].earned += answer.score;
      }
    });

    const percentages = {};
    competencyMeta.forEach((c) => {
      const { earned, max } = totals[c.key];
      percentages[c.key] = max > 0 ? Math.round((earned / max) * 100) : 0;
    });

    return percentages;
  }

  // 5개 역량 점수의 평균으로 전체 점수를 계산합니다. (문항 수 편차에 영향받지 않도록 함)
  function calculateOverallScore(competencyScores) {
    const values = competencyMeta.map((c) => competencyScores[c.key]);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.round(avg);
  }

  // 답변에 누적된 스타일 태그를 집계해 대표 스타일을 결정합니다.
  function calculateStyle(competencyScores) {
    const counts = {};
    const strengthSum = {}; // 동점 처리를 위한 보조 지표 (해당 스타일 선택 시 획득한 점수 합)

    state.answers.forEach((answer) => {
      if (!answer) return;
      counts[answer.style] = (counts[answer.style] || 0) + 1;
      strengthSum[answer.style] = (strengthSum[answer.style] || 0) + answer.score;
    });

    const maxCount = Math.max(...Object.values(counts));
    const topStyles = Object.keys(counts).filter((style) => counts[style] === maxCount);

    if (topStyles.length === 1) {
      return topStyles[0];
    }

    // 동점일 경우: 해당 스타일로 선택된 답변들의 점수 합이 가장 큰 스타일을 우선한다.
    // (역량 점수와 답변 패턴을 함께 고려해 배열 순서에 의존하지 않도록 함)
    let best = null;
    let bestScore = -1;
    topStyles.forEach((style) => {
      const score = strengthSum[style] || 0;
      if (score > bestScore) {
        bestScore = score;
        best = style;
      }
    });

    const bestCandidates = topStyles.filter((style) => (strengthSum[style] || 0) === bestScore);

    // 그래도 동점이면 균형가로 수렴
    if (bestCandidates.length > 1) {
      return "균형가";
    }

    return best;
  }

  function getScoreBand(score) {
    return scoreBands.find((band) => score >= band.min && score <= band.max) || scoreBands[0];
  }

  // 5개 역량 중 점수가 높은 상위 2개 (동점 시 competencyMeta 순서 유지)
  function getTopCompetencies(competencyScores, count) {
    return [...competencyMeta]
      .sort((a, b) => competencyScores[b.key] - competencyScores[a.key])
      .slice(0, count)
      .map((c) => c.key);
  }

  // 5개 역량 중 점수가 낮은 하위 N개 (동점 시 competencyMeta 순서 유지)
  function getBottomCompetencies(competencyScores, count) {
    return [...competencyMeta]
      .sort((a, b) => competencyScores[a.key] - competencyScores[b.key])
      .slice(0, count)
      .map((c) => c.key);
  }

  function calculateResults() {
    const competencyScores = calculateCompetencyScores();
    const overallScore = calculateOverallScore(competencyScores);
    const styleKey = calculateStyle(competencyScores);

    return {
      date: new Date().toISOString(),
      competencyScores,
      overallScore,
      styleKey,
    };
  }

  /* ---------------------------------------------------------
     7. 결과 화면 렌더링
  --------------------------------------------------------- */

  function finishQuiz() {
    const results = calculateResults();
    const previousResult = loadPreviousResult();
    saveResultToStorage(results);
    renderResults(results, previousResult);
    showScreen(el.screenResult);
  }

  function renderResults(results, previousResult) {
    const { competencyScores, overallScore, styleKey } = results;
    const style = styleMeta[styleKey];
    const band = getScoreBand(overallScore);

    // 스타일 카드
    el.styleEmoji.textContent = style.emoji;
    el.styleName.textContent = style.name;
    el.styleTagline.textContent = `“${style.tagline}”`;

    // 전체 점수
    el.scoreNumber.textContent = "0";
    el.scoreStage.textContent = band.title;
    el.scoreStageDesc.textContent = band.desc;
    animateNumber(el.scoreNumber, overallScore, 800);

    // 5개 역량 바 차트
    el.competencyList.innerHTML = "";
    competencyMeta.forEach((c) => {
      const score = competencyScores[c.key];

      const row = document.createElement("div");
      row.className = "competency-row";

      const head = document.createElement("div");
      head.className = "competency-row-head";
      head.innerHTML = `
        <span class="c-label">${c.emoji} ${c.label}</span>
        <span class="c-score">${score}</span>
      `;

      const track = document.createElement("div");
      track.className = "competency-bar-track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `${c.label} 점수`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(score));

      const fill = document.createElement("div");
      fill.className = "competency-bar-fill";
      fill.style.width = "0%";

      track.appendChild(fill);
      row.appendChild(head);
      row.appendChild(track);
      el.competencyList.appendChild(row);

      // 화면에 붙은 뒤 목표 너비로 부드럽게 채워지도록 함
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fill.style.width = score + "%";
        });
      });
    });

    // 나의 강점 (상위 2개 역량)
    const topKeys = getTopCompetencies(competencyScores, 2);
    el.strengthList.innerHTML = "";
    topKeys.forEach((key) => {
      const meta = competencyMeta.find((c) => c.key === key);
      el.strengthList.appendChild(
        buildInsightCard(`${meta.emoji} ${meta.label}`, strengthCopy[key])
      );
    });

    // 한 단계 성장하려면 (하위 1개 역량)
    const bottomKey = getBottomCompetencies(competencyScores, 1)[0];
    const bottomMeta = competencyMeta.find((c) => c.key === bottomKey);
    el.growthList.innerHTML = "";
    el.growthList.appendChild(
      buildInsightCard(`${bottomMeta.emoji} ${bottomMeta.label}`, growthCopy[bottomKey])
    );

    // 오늘 교육에서 집중할 내용 (하위 2개 역량)
    const focusKeys = getBottomCompetencies(competencyScores, 2);
    el.focusList.innerHTML = "";
    focusKeys.forEach((key) => {
      const item = document.createElement("div");
      item.className = "focus-item";
      const dot = document.createElement("span");
      dot.className = "focus-dot";
      dot.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.textContent = focusCopy[key];
      item.appendChild(dot);
      item.appendChild(text);
      el.focusList.appendChild(item);
    });

    // 이전 진단과 비교
    renderComparison(previousResult, overallScore);

    // 결과 복사용 데이터를 버튼에 보관
    el.btnCopy.dataset.payload = buildCopyText(results);
  }

  function buildInsightCard(titleHtml, bodyText) {
    const card = document.createElement("div");
    card.className = "insight-card";
    const head = document.createElement("div");
    head.className = "insight-card-head";
    head.textContent = titleHtml;
    const p = document.createElement("p");
    p.textContent = bodyText;
    card.appendChild(head);
    card.appendChild(p);
    return card;
  }

  function animateNumber(target, endValue, duration) {
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out
      const current = Math.round(endValue * eased);
      target.textContent = String(current);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        target.textContent = String(endValue);
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     8. 이전 결과 저장 / 비교 (localStorage)
  --------------------------------------------------------- */

  function loadPreviousResult() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed.overallScore !== "number") return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function saveResultToStorage(results) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    } catch (err) {
      // localStorage 사용 불가 환경(사생활 보호 모드 등)에서는 저장을 건너뜁니다.
    }
  }

  function renderComparison(previousResult, currentScore) {
    if (!previousResult) {
      el.compareBlock.hidden = true;
      return;
    }

    const prevScore = previousResult.overallScore;
    const diff = currentScore - prevScore;

    let deltaText = "";
    let deltaClass = "delta-same";
    if (diff > 0) {
      deltaText = `+${diff}`;
      deltaClass = "delta-up";
    } else if (diff < 0) {
      deltaText = `${diff}`;
      deltaClass = "delta-down";
    } else {
      deltaText = "±0";
    }

    el.compareValue.innerHTML = `이전 ${prevScore} → 현재 ${currentScore} <span class="${deltaClass}">${deltaText}</span>`;
    el.compareBlock.hidden = false;
  }

  /* ---------------------------------------------------------
     9. 결과 복사 (클립보드)
  --------------------------------------------------------- */

  function buildCopyText(results) {
    const { competencyScores, overallScore, styleKey } = results;
    const style = styleMeta[styleKey];

    const lines = [
      "나의 AI 업무활용 스타일",
      `${style.emoji} ${style.name}`,
      "",
      `AI 업무활용 점수 ${overallScore}점`,
    ];

    competencyMeta.forEach((c) => {
      lines.push(`${c.emoji} ${c.label} ${competencyScores[c.key]}`);
    });

    lines.push("");
    lines.push("AI WORKSTYLE CHECK");

    return lines.join("\n");
  }

  async function copyResults() {
    const text = el.btnCopy.dataset.payload || "";
    if (!text) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        legacyCopy(text);
      }
      showToast("결과가 복사되었습니다 ✓");
    } catch (err) {
      // 클립보드 API 접근이 막힌 환경을 위한 대체 경로
      try {
        legacyCopy(text);
        showToast("결과가 복사되었습니다 ✓");
      } catch (fallbackErr) {
        showToast("복사에 실패했습니다. 직접 선택해 복사해주세요.");
      }
    }
  }

  function legacyCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  /* ---------------------------------------------------------
     10. 다시 진단하기
  --------------------------------------------------------- */

  function resetTest() {
    clearTimeout(advanceTimer);
    state.currentIndex = 0;
    state.answers = new Array(TOTAL_QUESTIONS).fill(null);
    showScreen(el.screenStart);
  }

  /* ---------------------------------------------------------
     11. 이벤트 바인딩 & 초기화
  --------------------------------------------------------- */

  function bindEvents() {
    el.btnStart.addEventListener("click", startTest);
    el.btnPrev.addEventListener("click", goToPrevQuestion);
    el.btnCopy.addEventListener("click", copyResults);
    el.btnRestart.addEventListener("click", resetTest);

    // 진단 화면에서 키보드 숫자(1~4)로 선택지를 고를 수 있도록 지원
    document.addEventListener("keydown", (e) => {
      if (!el.screenQuiz.classList.contains("is-active")) return;
      const keyMap = { "1": "A", "2": "B", "3": "C", "4": "D" };
      const optionKey = keyMap[e.key];
      if (!optionKey) return;
      const target = el.optionsList.querySelector(`[data-option-key="${optionKey}"]`);
      if (target && !target.disabled) {
        target.click();
      }
    });
  }

  function init() {
    bindEvents();

    // 이전 진단 기록이 있다면 시작 화면에 살짝 안내
    const previous = loadPreviousResult();
    if (previous && typeof previous.overallScore === "number") {
      const dateStr = formatDate(previous.date);
      el.prevResultHint.querySelector("span").textContent =
        `이전 진단 기록이 있습니다 (${dateStr} · ${previous.overallScore}점)`;
      el.prevResultHint.hidden = false;
    }

    showScreen(el.screenStart);
  }

  function formatDate(isoString) {
    try {
      const d = new Date(isoString);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${mm}.${dd}`;
    } catch (err) {
      return "";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
