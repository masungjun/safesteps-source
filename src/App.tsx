import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import L from "leaflet"
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Construction,
  Eye,
  Footprints,
  HeartHandshake,
  Lightbulb,
  LocateFixed,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Plus,
  Search,
  School,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  TrafficCone,
  Users,
  X,
  Zap,
} from "lucide-react"
import "leaflet/dist/leaflet.css"

type Category = "보행로" | "가로등" | "교통" | "기타"
type Page = "map" | "news" | "about"
type Lang = "ko" | "en"

const LANG_KEY = "safesteps-ui-lang"

function loadLang(): Lang {
  try {
    localStorage.removeItem("safesteps-lang")
    return localStorage.getItem(LANG_KEY) === "ko" ? "ko" : "en"
  } catch {
    return "en"
  }
}

const categoryLabels: Record<Category, Record<Lang, string>> = {
  보행로: { ko: "보행로", en: "Sidewalk" },
  가로등: { ko: "가로등", en: "Streetlight" },
  교통: { ko: "교통", en: "Traffic" },
  기타: { ko: "기타", en: "Other" },
}

const statusLabels: Record<Report["status"], Record<Lang, string>> = {
  "접수 전": { ko: "접수 전", en: "Not reported yet" },
  신고함: { ko: "신고함", en: "Reported" },
  "처리 완료": { ko: "처리 완료", en: "Resolved" },
}

function categoryLabel(category: Category, lang: Lang): string {
  return categoryLabels[category][lang]
}

function statusLabel(status: Report["status"], lang: Lang): string {
  return statusLabels[status][lang]
}

function relativeDate(iso: string, lang: Lang): string {
  const parsed = new Date(iso).getTime()
  if (!Number.isFinite(parsed))
    return lang === "ko" ? "날짜 없음" : "No date"
  const diffDays = Math.floor((Date.now() - parsed) / DAY_MS)
  if (diffDays <= 0) return lang === "ko" ? "오늘" : "Today"
  if (diffDays === 1) return lang === "ko" ? "어제" : "Yesterday"
  return lang === "ko" ? `${diffDays}일 전` : `${diffDays}d ago`
}
type ReportStatus = "접수 전" | "신고함" | "처리 완료"

const STATUSES: ReportStatus[] = ["접수 전", "신고함", "처리 완료"]

// 이전 버전의 "확인 중"은 아직 신고 전 상태로 옮긴다.
function normalizeStatus(value: unknown): ReportStatus {
  return value === "처리 완료" || value === "신고함" ? value : "접수 전"
}

function normalizeHistory(report: { statusHistory?: unknown; status: ReportStatus; reportedAt: string }) {
  const list = Array.isArray(report.statusHistory)
    ? report.statusHistory.flatMap((item) =>
        item && typeof item.at === "string"
          ? [{ status: normalizeStatus(item.status), at: item.at }]
          : [],
      )
    : []
  return list.length ? list : [{ status: report.status, at: report.reportedAt }]
}

type Report = {
  id: number
  title: string
  category: Category
  address: string
  date: string
  reportedAt: string
  status: ReportStatus
  statusHistory?: { status: ReportStatus; at: string }[]
  photo?: string
  likes: number
  lat: number
  lng: number
  description: string
  isExample?: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

const strings: Record<Lang, Record<string, string>> = {
  ko: {
    exampleReadOnly: "예시 제보라 공감이 기록되지 않아요.",
    toastImportNone: "이미 있는 제보라 새로 가져온 것이 없어요.",
    pickTitle: "지도를 눌러 위험한 곳을 표시하세요",
    pickDesc: "핀을 끌어서 옮길 수도 있어요.",
    pickCancel: "취소",
    pickUseLocation: "내 위치로",
    pickConfirm: "이 위치로 계속",
    locationLabel: "표시한 위치",
    locationChange: "위치 다시 고르기",
    photoLabel: "사진 (선택)",
    photoNote: "사람 얼굴이나 차량 번호판이 나오지 않게 찍어 주세요.",
    photoRemove: "사진 빼기",
    photoFailed: "사진을 처리하지 못했어요. 다른 사진을 골라 주세요.",
    storageFull: "저장 공간이 부족해 일부 변경이 저장되지 않았어요. 사진을 줄이거나 백업 후 정리해 주세요.",
    editTitle: "제보 수정",
    editSubmit: "수정 저장하기",
    editButton: "수정",
    deleteButton: "삭제",
    deleteConfirm: "정말 삭제",
    deleted: "제보를 삭제했어요.",
    saved: "제보를 수정했어요.",
    added: "제보가 지도에 등록되었어요.",
    likedNotice: "이 제보에 공감했어요.",
    unlikedNotice: "공감을 취소했어요.",
    locationUnavailable: "현재 위치를 사용할 수 없어요.",
    locationDenied: "위치 권한을 허용하면 현재 위치를 볼 수 있어요.",
    statusField: "진행 상태",
    statusChanged: "진행 상태를 바꿨어요.",
    historyTitle: "진행 기록",
    copyComplaint: "민원 문안 복사",
    copied: "민원 문안을 복사했어요. 안전신문고에 붙여 넣어 신고해 주세요.",
    copyFailed: "복사하지 못했어요. 문안을 직접 옮겨 적어 주세요.",
    openSafetyReport: "안전신문고 열기",
    complaintNote: "앱이 자동으로 접수하지 않아요. 직접 신고한 뒤 상태를 '신고함'으로 바꿔 주세요.",
    complaintTitle: "제목",
    complaintCategory: "유형",
    complaintPlace: "장소",
    complaintCoords: "좌표",
    complaintDetail: "내용",
    complaintDate: "발견일",
    toolsButton: "정렬·내보내기",
    sortLabel: "정렬",
    sortNewest: "최신순",
    sortLikes: "공감 많은 순",
    statusFilterLabel: "진행 상태",
    statusAll: "전체",
    exportJson: "JSON 백업",
    statReported: "신고한 제보",
    statReportedNote: "직접 신고로 표시한 제보",
    myReports: "내 제보",
    brandTag: "학생 참여 안전지도",
    navMap: "안전지도",
    navNews: "활동소식",
    navAbout: "프로젝트 소개",
    reportButton: "위험 제보하기",
    menuOpen: "메뉴 열기",
    eyebrow: "우리의 관찰이 동네를 바꿔요",
    heroTitle1: "발견하고, 알리고,",
    heroTitle2: "함께 안전하게.",
    heroDesc1: "등하굣길에 발견한 위험 요소를 제보하고",
    heroDesc2: "우리 동네의 변화를 함께 만들어 보세요.",
    storageNotice:
      "제보는 이 기기에만 저장되며 자동으로 공유되거나 기관에 전달되지 않아요.",
    resolvedCount: "처리 완료한 내 제보",
    reporterCount: "이 기기의 내 제보",
    recentReports: "최근 제보",
    reportCountSuffix: "개의 제보",
    viewAll: "전체보기",
    emptyTitle: "검색 결과가 없어요.",
    emptyDesc: "다른 검색어나 분류를 선택해 보세요.",
    searchPlaceholder: "장소나 제보 내용 검색",
    clearSearch: "검색어 지우기",
    filterAll: "전체",
    myLocation: "내 위치",
    detailLabelSuffix: "안전 제보",
    detailClose: "상세 닫기",
    likeButton: "공감",
    newsEyebrow: "내 제보의 진행 기록",
    newsTitle1: "발견한 위험이",
    newsTitle2: "어떻게 되었는지 봐요.",
    newsDesc:
      "이 기기에 저장된 제보의 진행 상태를 모아 보여줘요. 실제 처리는 담당 기관에 신고해야 시작돼요.",
    newsCta: "안전지도에서 확인하기",
    resolvedTotal: "처리 완료로 표시한 제보",
    miniProofPrefix: "이 기기의 내 제보",
    miniProofSuffix: "건",
    statsEyebrow: "THIS MONTH",
    statsTitle: "이 기기의 제보 현황",
    statsNote: "예시 제보 제외",
    statNew: "내 제보",
    statResolved: "처리 완료",
    statLikes: "내 제보의 공감",
    statSchools: "참여 학교",
    statSchoolsNote: "이 기기 제보 지역 기준",
    storyEyebrow: "CHANGE STORIES",
    storyTitle: "제보 이후, 이렇게 달라졌어요",
    storyExampleNote:
      "이 사례는 화면 예시예요. 실제 처리 기록은 내 제보의 상태 변경 이력에서 확인할 수 있어요.",
    storyResult: "제보 후 5일 만에 처리 완료 (예시)",
    storySmall1: "학생 공감 · 3일 만에 해결 (예시)",
    storySmall2: "학생 공감 · 7일 만에 해결 (예시)",
    timelineEyebrow: "RECENT ACTIVITY",
    timelineTitle: "최근 진행 기록",
    timelineEmptyTime: "아직",
    timelineEmptyTitle: "첫 제보를 기다리고 있어요",
    timelineEmptyDesc: "이 기기에만 저장돼요",
    ctaEyebrow: "나의 관찰도 변화를 만들 수 있어요",
    ctaTitle: "오늘 발견한 위험을 알려주세요.",
    aboutEyebrow: "학생이 만드는 CIVIC TECH",
    aboutTitle1: "우리 동네의 안전은",
    aboutTitle2: "우리의 눈에서 시작됩니다.",
    aboutDesc:
      "‘SafeSteps’는 학생들이 일상의 위험을 직접 발견하고, 기록하고, 지역사회와 함께 해결하는 시민 기술 프로젝트입니다.",
    aboutCta1: "안전지도 둘러보기",
    aboutCta2: "첫 제보 남기기",
    quoteExample: "— 화면 예시 (실제 인용 아님)",
    quoteText:
      "매일 걷는 길이지만, 관심을 갖고 바라보니 바꿀 수 있는 것들이 보이기 시작했어요.",
    missionDiscover: "발견",
    missionRecord: "기록",
    missionChange: "변화",
    storyFeaturedTitle: "들떠 있던 통학로 보도블록이 평평하고 안전해졌어요",
    storySmall1Title: "어두웠던 골목에 다시 불이 켜졌어요",
    storySmall2Title: "기울어진 어린이 보호구역 표지판을 바로 세웠어요",
    statExamples: "예시 제외",
    whyEyebrow: "WHY WE STARTED",
    whyTitle1: "가장 가까이 있는 사람이",
    whyTitle2: "가장 먼저 발견할 수 있으니까",
    whyBody:
      "학생들은 매일 같은 통학로와 골목을 걷습니다. 행정기관보다 먼저 깨진 보도블록과 어두운 가로등을 발견할 수 있는 사람들이기도 합니다. 이 관찰이 사라지지 않고 실제 변화로 이어지도록 지도를 만들었습니다.",
    howEyebrow: "HOW IT WORKS",
    howTitle: "세 단계면 충분해요",
    howDesc: "발견한 위험을 쉽고 안전하게 지역사회에 알려보세요.",
    step1Title: "동네를 관찰해요",
    step1Desc: "등하굣길과 자주 걷는 골목에서 위험한 곳을 세심하게 살펴봐요.",
    step2Title: "지도에 기록해요",
    step2Desc: "위치와 상황을 짧게 작성하면 안전지도에 바로 표시돼요.",
    step3Title: "함께 변화를 만들어요",
    step3Desc:
      "민원 문안을 복사해 안전신문고 등 공식 채널로 직접 신고하면 해결에 연결할 수 있어요.",
    principlesEyebrow: "OUR PRINCIPLES",
    principlesTitle: "우리가 지키는 약속",
    principle1Title: "안전한 참여",
    principle1Desc:
      "개인정보 없이 위험 상황만 기록하고, 학생의 안전을 가장 먼저 생각합니다.",
    principle2Title: "함께하는 해결",
    principle2Desc:
      "제보를 민원 문안으로 정리해 담당 기관에 직접 신고할 수 있게 돕습니다.",
    principle3Title: "투명한 과정",
    principle3Desc: "제보의 진행 상태를 내 제보 목록에서 확인할 수 있습니다.",
    principle4Title: "열린 시민 기술",
    principle4Desc:
      "누구나 쉽게 참여할 수 있는 기술로 더 나은 지역사회를 만듭니다.",
    aboutCtaEyebrow: "우리 동네 안전 지킴이가 되어주세요",
    aboutCtaTitle: "당신의 첫 번째 발견을 기다리고 있어요.",
    startNow: "지금 시작하기",
    modalKicker: "우리 동네 안전 지킴이",
    modalTitle: "어떤 위험을 발견했나요?",
    modalDesc1: "현재 지도의 중심 위치에 제보가 표시돼요.",
    modalDesc2: "정확한 위치로 지도를 먼저 이동해 주세요.",
    formTitle: "제보 제목",
    formTitlePlaceholder: "예: 보도블록이 깨져 있어요",
    formCategory: "위험 유형",
    formAddress: "발견 장소",
    formAddressPlaceholder: "도로명이나 건물 이름",
    formDescription: "자세한 설명",
    formDescriptionPlaceholder: "위험한 상황을 자세히 알려주세요.",
    formNote: "개인정보가 포함되지 않도록 확인해 주세요.",
    formSubmit: "안전 제보 등록하기",
    footerDesc: "학생의 관찰과 참여로 더 안전한 지역사회를 만듭니다.",
    footerCopyright: "© 2025 SafeSteps. 학생 시민기술 프로젝트.",
    toastRegistered: "제보가 지도에 등록되었어요.",
    toastLiked: "이 제보에 공감했어요.",
    toastUnliked: "공감을 취소했어요.",
    toastNoLocation: "현재 위치를 사용할 수 없어요.",
    toastLocationDenied: "위치 권한을 허용하면 현재 위치를 볼 수 있어요.",
    exampleTag: "예시",
    exportCsv: "CSV 내보내기",
    exportGeojson: "GeoJSON 내보내기",
    importJson: "JSON 가져오기",
    toastExportedCsv: "CSV 파일을 내려받았어요.",
    toastExportedGeojson: "GeoJSON 파일을 내려받았어요.",
    toastImported: "제보 {count}개를 가져왔어요.",
    toastImportFailed: "파일을 가져오지 못했어요.",
    langToggle: "EN",
  },
  en: {
    exampleReadOnly: "This is an example, so support isn't recorded.",
    toastImportNone: "Those reports are already here, so nothing new was added.",
    pickTitle: "Tap the map to mark the hazard",
    pickDesc: "You can also drag the pin.",
    pickCancel: "Cancel",
    pickUseLocation: "My location",
    pickConfirm: "Continue with this spot",
    locationLabel: "Marked location",
    locationChange: "Choose again",
    photoLabel: "Photo (optional)",
    photoNote: "Please avoid showing faces or license plates.",
    photoRemove: "Remove photo",
    photoFailed: "Couldn't process the photo. Please choose another.",
    storageFull: "Not enough storage, so some changes weren't saved. Remove photos or back up and clean up.",
    editTitle: "Edit report",
    editSubmit: "Save changes",
    editButton: "Edit",
    deleteButton: "Delete",
    deleteConfirm: "Really delete",
    deleted: "Report deleted.",
    saved: "Report updated.",
    added: "Report added to the map.",
    likedNotice: "You supported this report.",
    unlikedNotice: "Support removed.",
    locationUnavailable: "Your location isn't available.",
    locationDenied: "Allow location access to see where you are.",
    statusField: "Status",
    statusChanged: "Status updated.",
    historyTitle: "History",
    copyComplaint: "Copy complaint text",
    copied: "Copied. Paste it into the Safety Report site to file it.",
    copyFailed: "Couldn't copy. Please write the text down manually.",
    openSafetyReport: "Open Safety Report (Korea)",
    complaintNote: "The app doesn't file anything for you. After filing it yourself, set the status to 'Reported'.",
    complaintTitle: "Title",
    complaintCategory: "Type",
    complaintPlace: "Place",
    complaintCoords: "Coordinates",
    complaintDetail: "Details",
    complaintDate: "Found on",
    toolsButton: "Sort & export",
    sortLabel: "Sort",
    sortNewest: "Newest",
    sortLikes: "Most supported",
    statusFilterLabel: "Status",
    statusAll: "All",
    exportJson: "JSON backup",
    statReported: "Reports filed",
    statReportedNote: "Marked as filed by you",
    myReports: "My reports",
    brandTag: "Student safety map",
    navMap: "Safety Map",
    navNews: "News",
    navAbout: "About",
    reportButton: "Report a hazard",
    menuOpen: "Open menu",
    eyebrow: "Our eyes change the neighborhood",
    heroTitle1: "Spot it, share it,",
    heroTitle2: "make it safe together.",
    heroDesc1: "Report hazards you find on your way to school",
    heroDesc2: "and build a safer neighborhood together.",
    storageNotice:
      "Reports are stored on this device only and are never shared automatically or sent to any agency.",
    resolvedCount: "My resolved reports",
    reporterCount: "My reports on this device",
    recentReports: "Recent reports",
    reportCountSuffix: "reports",
    viewAll: "View all",
    emptyTitle: "No results found.",
    emptyDesc: "Try another keyword or category.",
    searchPlaceholder: "Search places or reports",
    clearSearch: "Clear search",
    filterAll: "All",
    myLocation: "My location",
    detailLabelSuffix: "safety report",
    detailClose: "Close details",
    likeButton: "Like",
    newsEyebrow: "Progress of my reports",
    newsTitle1: "See what happened",
    newsTitle2: "to the hazards you found.",
    newsDesc:
      "This shows the status of reports saved on this device. Real fixes begin only after you file with the responsible agency.",
    newsCta: "See it on the map",
    resolvedTotal: "Reports marked resolved",
    miniProofPrefix: "My reports on this device:",
    miniProofSuffix: "",
    statsEyebrow: "THIS MONTH",
    statsTitle: "Reports on this device",
    statsNote: "Examples excluded",
    statNew: "My reports",
    statResolved: "Resolved",
    statLikes: "Support on my reports",
    statSchools: "Participating schools",
    statSchoolsNote: "Based on report locations on this device",
    storyEyebrow: "CHANGE STORIES",
    storyTitle: "What changed after the reports",
    storyExampleNote:
      "This story is a screen example. Real resolution history appears in the status history of your own reports.",
    storyResult: "Resolved 5 days after the report (example)",
    storySmall1: "Student likes · resolved in 3 days (example)",
    storySmall2: "Student likes · resolved in 7 days (example)",
    timelineEyebrow: "RECENT ACTIVITY",
    timelineTitle: "Recent progress",
    timelineEmptyTime: "Yet",
    timelineEmptyTitle: "Waiting for the first report",
    timelineEmptyDesc: "Stored on this device only",
    ctaEyebrow: "Your observations can make change too",
    ctaTitle: "Tell us about a hazard you found today.",
    aboutEyebrow: "CIVIC TECH BY STUDENTS",
    aboutTitle1: "Neighborhood safety starts",
    aboutTitle2: "with our own eyes.",
    aboutDesc:
      "'SafeSteps' is a civic tech project where students discover, record, and resolve everyday hazards together with their community.",
    aboutCta1: "Explore the map",
    aboutCta2: "Leave your first report",
    quoteExample: "— Screen example (not a real quote)",
    quoteText:
      "I walk this road every day, but looking closely, I began to see things I could change.",
    missionDiscover: "Discover",
    missionRecord: "Record",
    missionChange: "Change",
    storyFeaturedTitle:
      "The wobbly sidewalk blocks on our school route are flat and safe again",
    storySmall1Title: "The dark alley has light again",
    storySmall2Title: "The tilted school-zone sign was straightened",
    statExamples: "Examples excluded",
    whyEyebrow: "WHY WE STARTED",
    whyTitle1: "The closest person",
    whyTitle2: "finds it first",
    whyBody:
      "Students walk the same school routes and alleys every day. They can spot broken sidewalks and dark streetlights before anyone else. We built this map so those observations turn into real change.",
    howEyebrow: "HOW IT WORKS",
    howTitle: "Just three steps",
    howDesc: "Share what you found easily and safely with your community.",
    step1Title: "Observe your neighborhood",
    step1Desc: "Look closely at hazards on your route and familiar alleys.",
    step2Title: "Record it on the map",
    step2Desc: "Write a short note with the location and it appears on the map.",
    step3Title: "Make change together",
    step3Desc:
      "Copy a complaint draft and report it through official channels like the Safety Report portal.",
    principlesEyebrow: "OUR PRINCIPLES",
    principlesTitle: "Our promises",
    principle1Title: "Safe participation",
    principle1Desc:
      "We record hazards without personal information and put student safety first.",
    principle2Title: "Solving together",
    principle2Desc:
      "Turns a report into complaint text so you can file it with the agency yourself.",
    principle3Title: "Transparent process",
    principle3Desc: "You can track each report's status in your own report list.",
    principle4Title: "Open civic tech",
    principle4Desc:
      "We build better communities with technology anyone can use.",
    aboutCtaEyebrow: "Become a neighborhood safety keeper",
    aboutCtaTitle: "Your first discovery is waiting.",
    startNow: "Get started",
    modalKicker: "Neighborhood safety keeper",
    modalTitle: "What hazard did you find?",
    modalDesc1: "The report will be placed at the current map center.",
    modalDesc2: "Please move the map to the exact location first.",
    formTitle: "Report title",
    formTitlePlaceholder: "e.g. Broken sidewalk blocks",
    formCategory: "Hazard type",
    formAddress: "Location",
    formAddressPlaceholder: "Street name or building",
    formDescription: "Details",
    formDescriptionPlaceholder: "Describe the hazardous situation in detail.",
    formNote: "Please make sure no personal information is included.",
    formSubmit: "Submit safety report",
    footerDesc: "Building a safer community through student observation.",
    footerCopyright: "© 2025 SafeSteps. A student civic tech project.",
    toastRegistered: "Your report has been added to the map.",
    toastLiked: "You liked this report.",
    toastUnliked: "Like removed.",
    toastNoLocation: "Your current location is unavailable.",
    toastLocationDenied: "Allow location access to see where you are.",
    exampleTag: "Example",
    exportCsv: "Export CSV",
    exportGeojson: "Export GeoJSON",
    importJson: "Import JSON",
    toastExportedCsv: "CSV file downloaded.",
    toastExportedGeojson: "GeoJSON file downloaded.",
    toastImported: "Imported {count} reports.",
    toastImportFailed: "Could not import the file.",
    langToggle: "한국어",
  },
} as const

const categoryMeta: Record<Category, {
  color: string
  soft: string
  icon: typeof Construction
}> = {
  보행로: { color: "#F05A3A", soft: "#FFF1EC", icon: Construction },
  가로등: { color: "#7A5AF8", soft: "#F1EEFF", icon: Zap },
  교통: { color: "#E5A000", soft: "#FFF7D9", icon: TrafficCone },
  기타: { color: "#47757B", soft: "#EAF3F3", icon: AlertTriangle },
}

const initialReports: Report[] = [
  {
    id: 1,
    title: "깨진 보도블록이 위험해요",
    category: "보행로",
    address: "서울 마포구 월드컵북로 122",
    date: "오늘",
    reportedAt: isoDaysAgo(0),
    status: "접수 전",
    likes: 24,
    lat: 37.5637,
    lng: 126.9169,
    description:
      "보도블록 여러 장이 깨지고 들떠 있어 등하굣길에 발이 걸릴 위험이 있습니다.",
    isExample: true,
  },
  {
    id: 2,
    title: "가로등이 며칠째 꺼져 있어요",
    category: "가로등",
    address: "서울 마포구 성미산로 89",
    date: "어제",
    reportedAt: isoDaysAgo(1),
    status: "접수 전",
    likes: 18,
    lat: 37.5608,
    lng: 126.9208,
    description:
      "골목 입구 가로등이 꺼져 있어 야간 통행 시 주변이 너무 어둡습니다.",
    isExample: true,
  },
  {
    id: 3,
    title: "어린이 보호구역 표지판 파손",
    category: "교통",
    address: "서울 마포구 동교로 25길",
    date: "3일 전",
    reportedAt: isoDaysAgo(3),
    status: "처리 완료",
    likes: 31,
    lat: 37.5586,
    lng: 126.9143,
    description:
      "표지판이 기울어져 운전자가 어린이 보호구역임을 알아보기 어렵습니다.",
    isExample: true,
  },
  {
    id: 4,
    title: "골목길 배수구 덮개 흔들림",
    category: "기타",
    address: "서울 마포구 연남로 34",
    date: "5일 전",
    reportedAt: isoDaysAgo(5),
    status: "접수 전",
    likes: 9,
    lat: 37.5667,
    lng: 126.9236,
    description: "사람이 밟을 때마다 덮개가 크게 흔들리고 소리가 납니다.",
    isExample: true,
  },
]

const exampleEn: Record<number, { title: string; address: string; description: string }> = {
  1: {
    title: "Broken sidewalk tiles",
    address: "122 World Cup Buk-ro, Mapo-gu, Seoul",
    description: "Several sidewalk tiles are cracked and lifted, so people can trip on the way to school.",
  },
  2: {
    title: "A streetlight has been out for days",
    address: "89 Seongmisan-ro, Mapo-gu, Seoul",
    description: "The streetlight at the alley entrance is out, so the area is very dark at night.",
  },
  3: {
    title: "Damaged school-zone sign",
    address: "25-gil, Donggyo-ro, Mapo-gu, Seoul",
    description: "The sign is tilted, so drivers may not notice the school zone.",
  },
  4: {
    title: "Loose drain cover in an alley",
    address: "34 Yeonnam-ro, Mapo-gu, Seoul",
    description: "The cover rocks and makes a loud noise whenever someone steps on it.",
  },
}

function localizeReport(report: Report, lang: Lang): Report {
  if (lang !== "en" || !report.isExample) return report
  const text = exampleEn[report.id]
  return text ? { ...report, ...text } : report
}

const REPORTS_KEY = "safe-map-reports"

const csvEscaped = (value: string | number) =>
  `"${String(value).replace(/"/g, '""')}"`

function reportsToCsv(reports: Report[]): string {
  const header = [
    "제목",
    "분류",
    "상태",
    "주소",
    "위도",
    "경도",
    "날짜",
    "공감수",
  ]
  const rows = reports.map((report) =>
    [
      report.title,
      report.category,
      report.status,
      report.address,
      report.lat,
      report.lng,
      report.reportedAt,
      report.likes,
    ]
      .map(csvEscaped)
      .join(","),
  )
  return `\uFEFF${[header.join(","), ...rows].join("\r\n")}`
}

function reportsToGeojson(reports: Report[]): string {
  return JSON.stringify({
    type: "FeatureCollection",
    features: reports.map((report) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [report.lng, report.lat],
      },
      properties: {
        제목: report.title,
        분류: report.category,
        id: report.id,
        상태: report.status,
        주소: report.address,
        날짜: report.reportedAt,
        공감수: report.likes,
      },
    })),
  })
}

function parseImportedReports(raw: string): Report[] {
  const parsed: unknown = JSON.parse(raw)
  const list = Array.isArray(parsed)
    ? parsed
    : parsed !== null &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { features?: unknown }).features)
      ? ((parsed as { features: unknown[] }).features)
      : []
  return list.flatMap((item, index) => {
    if (item === null || typeof item !== "object") return []
    const source = item as Record<string, unknown>
    const geometry = source.geometry as
      | { coordinates?: unknown[] }
      | undefined
    const lng = Array.isArray(geometry?.coordinates)
      ? Number(geometry?.coordinates?.[0])
      : Number(source.lng)
    const lat = Array.isArray(geometry?.coordinates)
      ? Number(geometry?.coordinates?.[1])
      : Number(source.lat)
    const props = (source.properties ?? {}) as Record<string, unknown>
    const title = String(source.title ?? props["제목"] ?? "").trim()
    if (
      !title ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      return []
    const reportedAt = String(source.reportedAt ?? props["날짜"] ?? "") || new Date().toISOString()
    const photo = typeof source.photo === "string" && source.photo.startsWith("data:image/") ? source.photo : undefined
    const category = String(source.category ?? props["분류"] ?? "기타")
    const status = String(source.status ?? props["상태"] ?? "접수 전")
    return [
      {
        id: Number(source.id ?? props.id) || Date.now() + index,
        title,
        category: (["보행로", "가로등", "교통", "기타"].includes(category)
          ? category
          : "기타") as Category,
        address: String(source.address ?? props["주소"] ?? ""),
        date: String(source.date ?? "가져옴"),
        reportedAt,
        status: normalizeStatus(status),
        statusHistory: normalizeHistory({ statusHistory: source.statusHistory, status: normalizeStatus(status), reportedAt }),
        photo,
        likes: Number(source.likes ?? props["공감수"] ?? 0) || 0,
        lat,
        lng,
        description: String(source.description ?? ""),
        isExample: false,
      },
    ]
  })
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function complaintText(report: Report, t: Record<string, string>, lang: Lang) {
  report = localizeReport(report, lang)
  return [
    `${t.complaintTitle}: ${report.title}`,
    `${t.complaintCategory}: ${categoryLabel(report.category, lang)}`,
    `${t.complaintPlace}: ${report.address}`,
    `${t.complaintCoords}: ${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}`,
    `${t.complaintDate}: ${report.reportedAt.slice(0, 10)}`,
    `${t.complaintDetail}: ${report.description}`,
  ].join("\n")
}

// 저장 공간을 아끼려고 긴 변 1024px JPEG로 줄이고, 그래도 크면 화질을 더 낮춘다.
async function compressPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const quality of [0.72, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality)
    if (url.length < 400_000) return url
  }
  throw new Error("too large")
}

type Draft = {
  id: number | null
  title: string
  category: Category
  address: string
  description: string
  photo: string
  lat: number
  lng: number
}

function markerHtml(report: Report, active: boolean) {  const meta = categoryMeta[report.category]
  return `<div class="map-marker ${
    active ? "is-active" : ""
  }" style="--marker-color:${meta.color}">
    <span>${
      report.category === "보행로"
        ? "▰"
        : report.category === "가로등"
          ? "✦"
          : report.category === "교통"
            ? "!"
            : "•"
    }</span>
  </div>`
}

function PageFooter({
  navigate,
  t,
}: {
  navigate: (page: Page) => void
  t: (typeof strings)["ko"]
}) {
  return (
    <footer className="page-footer">
      <button className="footer-brand" onClick={() => navigate("map")}>
        <span className="brand-mark">
          <ShieldCheck size={21} />
        </span>
        <span>
          <b>SafeSteps</b>
          <small>{t.brandTag}</small>
        </span>
      </button>
      <p>{t.footerDesc}</p>
      <div>
        <button onClick={() => navigate("map")}>{t.navMap}</button>
        <button onClick={() => navigate("news")}>{t.navNews}</button>
        <button onClick={() => navigate("about")}>{t.navAbout}</button>
      </div>
      <small>{t.footerCopyright}</small>
    </footer>
  )
}

function App() {
  const mapNode = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markerLayer = useRef<L.LayerGroup | null>(null)
  const [reports, setReports] = useState<Report[]>(() => {
    try {
      const saved = localStorage.getItem("safe-map-reports")
      if (!saved) return initialReports
      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) return initialReports
      return parsed.map((report: Report) => {
        const reportedAt =
          typeof report.reportedAt === "string" && report.reportedAt
            ? report.reportedAt
            : new Date().toISOString()
        const status = normalizeStatus(report.status)
        return {
          ...report,
          reportedAt,
          status,
          statusHistory: normalizeHistory({ ...report, status, reportedAt }),
          isExample: report.isExample ?? false,
        }
      })
    } catch {
      return initialReports
    }
  })
  const [filter, setFilter] = useState<"전체" | Category>("전체")
  const [selected, setSelected] = useState<number | null>(() => (window.innerWidth > 700 ? 1 : null))
  const [query, setQuery] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [statusFilter, setStatusFilter] = useState<"전체" | ReportStatus>("전체")
  const [sort, setSort] = useState<"newest" | "likes">("newest")
  const [toolsOpen, setToolsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [likedIds, setLikedIds] = useState<number[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("safe-map-liked") || "[]")
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "number") : []
    } catch {
      return []
    }
  })
  const pinRef = useRef<L.Marker | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState("")
  const [lang, setLang] = useState<Lang>(loadLang)
  const t = strings[lang]
  const [page, setPage] = useState<Page>(() => {
    const initial = window.location.hash.replace("#", "")
    return ["map", "news", "about"].includes(initial)
      ? (initial as Page)
      : "map"
  })

  const filteredReports = useMemo(
    () =>
      reports
        .filter(
          (report) =>
            (filter === "전체" || report.category === filter) &&
            (statusFilter === "전체" || report.status === statusFilter) &&
            `${localizeReport(report, lang).title} ${localizeReport(report, lang).address} ${localizeReport(report, lang).description} ${report.title} ${report.address} ${report.description}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "likes"
            ? b.likes - a.likes
            : b.reportedAt.localeCompare(a.reportedAt),
        ),
    [filter, statusFilter, sort, query, reports, lang],
  )

  const activeReport = reports.find((report) => report.id === selected)
  // 예시 제보는 실적 수치에 넣지 않는다.
  const ownReports = reports.filter((report) => !report.isExample)
  const resolvedCount = ownReports.filter(
    (report) => report.status === "처리 완료",
  ).length
  const reportedCount = ownReports.filter(
    (report) => report.status !== "접수 전",
  ).length
  const timelineEvents = ownReports
    .flatMap((report) =>
      (report.statusHistory ?? []).map((event) => ({ ...event, report })),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8)

  useEffect(() => {
    document.title =
      lang === "ko"
        ? "SafeSteps — 학생 참여 안전지도"
        : "SafeSteps — Student safety map"
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    if (!mapNode.current || map.current) return
    map.current = L.map(mapNode.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([37.5624, 126.9191], 15)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map.current)
    L.control.zoom({ position: "bottomright" }).addTo(map.current)
    markerLayer.current = L.layerGroup().addTo(map.current)
    setTimeout(() => map.current?.invalidateSize(), 100)
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    if (!map.current || !markerLayer.current) return
    markerLayer.current.clearLayers()
    filteredReports.forEach((report) => {
      const marker = L.marker([report.lat, report.lng], {
        icon: L.divIcon({
          className: "custom-marker-wrap",
          html: markerHtml(report, selected === report.id),
          iconSize: [44, 52],
          iconAnchor: [22, 48],
        }),
      })
      marker.on("click", () => setSelected(report.id))
      markerLayer.current?.addLayer(marker)
    })
  }, [filteredReports, selected])

  useEffect(() => {
    try {
      localStorage.setItem("safe-map-reports", JSON.stringify(reports))
    } catch {
      showNotice(strings[lang].storageFull)
    }
  }, [reports])

  useEffect(() => setConfirmDelete(false), [selected])

  // 위치 고르기: 핀을 놓고 끌어서 옮긴다.
  useEffect(() => {
    if (!picking || !map.current || !draft) return
    const instance = map.current
    const pin = L.marker([draft.lat, draft.lng], {
      draggable: true,
      autoPan: true,
      icon: L.divIcon({
        className: "custom-marker-wrap",
        html: '<div class="pick-pin"></div>',
        iconSize: [34, 34],
        iconAnchor: [17, 32],
      }),
    }).addTo(instance)
    pinRef.current = pin
    const onClick = (event: L.LeafletMouseEvent) => pin.setLatLng(event.latlng)
    instance.on("click", onClick)
    instance.getContainer().classList.add("is-picking")
    return () => {
      instance.off("click", onClick)
      instance.getContainer().classList.remove("is-picking")
      pin.remove()
      pinRef.current = null
    }
  }, [picking])

  // 모달 포커스와 Esc. 열릴 때 한 번만 등록한다.
  useEffect(() => {
    if (!isFormOpen) return
    const opener = document.activeElement as HTMLElement | null
    modalRef.current?.querySelector<HTMLElement>("input, select, textarea")?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFormOpen(false)
        return
      }
      if (event.key !== "Tab" || !modalRef.current) return
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(
        "input, select, textarea, button:not(:disabled)",
      )
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      opener?.focus?.()
    }
  }, [isFormOpen])

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 2400)
  }

  const navigate = (nextPage: Page) => {
    setPage(nextPage)
    window.location.hash = nextPage
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
    if (nextPage === "map") {
      window.setTimeout(() => map.current?.invalidateSize(), 80)
    }
  }

  useEffect(() => {
    const handleHashChange = () => {
      const nextPage = window.location.hash.replace("#", "")
      if (["map", "news", "about"].includes(nextPage))
        setPage(nextPage as Page)
    }
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  const moveToCurrentLocation = () => {
    if (!navigator.geolocation) return showNotice(t.locationUnavailable)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        map.current?.flyTo([coords.latitude, coords.longitude], 16)
        pinRef.current?.setLatLng([coords.latitude, coords.longitude])
      },
      () => showNotice(t.locationDenied),
    )
  }

  const startReport = () => {
    navigate("map")
    setMenuOpen(false)
    setSelected(null)
    const center = map.current?.getCenter() ?? L.latLng(37.5624, 126.9191)
    setDraft({
      id: null,
      title: "",
      category: "보행로",
      address: "",
      description: "",
      photo: "",
      lat: center.lat,
      lng: center.lng,
    })
    setIsFormOpen(false)
    setPicking(true)
  }

  const confirmPick = () => {
    const position = pinRef.current?.getLatLng()
    if (position)
      setDraft((current) =>
        current ? { ...current, lat: position.lat, lng: position.lng } : current,
      )
    setPicking(false)
    setIsFormOpen(true)
  }

  const cancelPick = () => {
    setPicking(false)
    // 수정 중 위치를 다시 고르던 경우에는 폼으로 돌아간다.
    if (draft?.id || draft?.title) setIsFormOpen(true)
    else setDraft(null)
  }

  const startEdit = (report: Report) => {
    setDraft({
      id: report.id,
      title: report.title,
      category: report.category,
      address: report.address,
      description: report.description,
      photo: report.photo ?? "",
      lat: report.lat,
      lng: report.lng,
    })
    setIsFormOpen(true)
  }

  const changeStatus = (report: Report, status: ReportStatus) => {
    if (status === report.status) return
    const at = new Date().toISOString()
    setReports((current) =>
      current.map((item) =>
        item.id === report.id
          ? {
              ...item,
              status,
              statusHistory: [...(item.statusHistory ?? []), { status, at }],
            }
          : item,
      ),
    )
    showNotice(t.statusChanged)
  }

  const deleteReport = (id: number) => {
    setReports((current) => current.filter((item) => item.id !== id))
    setSelected(null)
    setConfirmDelete(false)
    showNotice(t.deleted)
  }

  const copyComplaint = async (report: Report) => {
    try {
      await navigator.clipboard.writeText(complaintText(report, t, lang))
      showNotice(t.copied)
    } catch {
      // 클립보드 권한이 없으면 문안을 화면에 보여줘 옮겨 적을 수 있게 한다.
      showNotice(complaintText(report, t, lang))
    }
  }

  const onPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      const photo = await compressPhoto(file)
      setDraft((current) => (current ? { ...current, photo } : current))
    } catch {
      showNotice(t.photoFailed)
    }
  }

  const selectReport = (report: Report) => {
    setSelected(report.id)
    map.current?.flyTo([report.lat, report.lng], 16, { duration: 0.7 })
  }

  const submitDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return
    const fields = {
      title: draft.title.trim(),
      category: draft.category,
      address: draft.address.trim(),
      description: draft.description.trim(),
      photo: draft.photo || undefined,
      lat: draft.lat,
      lng: draft.lng,
    }
    let targetId = draft.id
    if (targetId) {
      setReports((current) =>
        current.map((report) =>
          report.id === targetId ? { ...report, ...fields } : report,
        ),
      )
      showNotice(t.saved)
    } else {
      targetId = Date.now()
      const reportedAt = new Date().toISOString()
      const newReport: Report = {
        ...fields,
        id: targetId,
        date: "",
        reportedAt,
        status: "접수 전",
        statusHistory: [{ status: "접수 전", at: reportedAt }],
        likes: 0,
      }
      setReports((current) => [newReport, ...current])
      showNotice(t.added)
    }
    setSelected(targetId)
    setFilter("전체")
    setStatusFilter("전체")
    setIsFormOpen(false)
    setDraft(null)
    window.setTimeout(() => map.current?.flyTo([fields.lat, fields.lng], 16), 120)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const exportCsv = () => {
    downloadText(
      `safesteps-reports-${new Date().toISOString().slice(0, 10)}.csv`,
      reportsToCsv(reports),
    )
    showNotice(t.toastExportedCsv)
  }

  const exportGeojson = () => {
    downloadText(
      `safesteps-reports-${new Date().toISOString().slice(0, 10)}.geojson`,
      reportsToGeojson(reports),
    )
    showNotice(t.toastExportedGeojson)
  }

  const exportJson = () => {
    downloadText(
      `safesteps-reports-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(reports, null, 2),
    )
  }

  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    file
      .text()
      .then((text) => {
        const incoming = parseImportedReports(text)
        // id가 없는 파일도 있으니 제목·좌표가 같으면 같은 제보로 본다.
        const keyOf = (report: Report) => `${report.title}|${report.lat.toFixed(5)}|${report.lng.toFixed(5)}`
        const existingIds = new Set(reports.map((report) => report.id))
        const existingKeys = new Set(reports.map(keyOf))
        const fresh = incoming.filter((report) => {
          if (existingIds.has(report.id) || existingKeys.has(keyOf(report))) return false
          existingIds.add(report.id)
          existingKeys.add(keyOf(report))
          return true
        })
        if (fresh.length > 0) setReports((current) => [...fresh, ...current])
        showNotice(
          fresh.length > 0
            ? t.toastImported.replace("{count}", String(fresh.length))
            : incoming.length > 0
              ? t.toastImportNone
              : t.toastImportFailed,
        )
      })
      .catch(() => showNotice(t.toastImportFailed))
  }

  const likeReport = (id: number) => {
    if (reports.find((report) => report.id === id)?.isExample) {
      showNotice(t.exampleReadOnly)
      return
    }
    const isLiked = likedIds.includes(id)
    const next = isLiked ? likedIds.filter((likedId) => likedId !== id) : [...likedIds, id]
    setLikedIds(next)
    try {
      localStorage.setItem("safe-map-liked", JSON.stringify(next))
    } catch {
      // storage unavailable — keep in-memory only
    }
    setReports((current) =>
      current.map((report) =>
        report.id === id
          ? { ...report, likes: Math.max(0, report.likes + (isLiked ? -1 : 1)) }
          : report,
      ),
    )
    showNotice(isLiked ? t.unlikedNotice : t.likedNotice)
  }

  return (
    <div className={`app-shell ${page !== "map" ? "content-mode" : ""} ${picking ? "picking" : ""}`}>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            navigate("map")
            window.setTimeout(
              () => map.current?.setView([37.5624, 126.9191], 15),
              100,
            )
          }}
        >
          <span className="brand-mark">
            <ShieldCheck size={23} strokeWidth={2.4} />
          </span>
          <span>
            <b>SafeSteps</b>
            <small>{t.brandTag}</small>
          </span>
        </button>
        <nav className={menuOpen ? "nav is-open" : "nav"}>
          <button
            className={page === "map" ? "active" : ""}
            onClick={() => navigate("map")}
          >
            {t.navMap}
          </button>
          <button
            className={page === "news" ? "active" : ""}
            onClick={() => navigate("news")}
          >
            {t.navNews}
          </button>
          <button
            className={page === "about" ? "active" : ""}
            onClick={() => navigate("about")}
          >
            {t.navAbout}
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="lang-toggle"
            onClick={() => {
              const next = lang === "ko" ? "en" : "ko"
              setLang(next)
              try {
                localStorage.setItem(LANG_KEY, next)
              } catch {
                /* 저장 실패 시에도 화면 전환은 유지 */
              }
            }}
          >
            {t.langToggle}
          </button>
          <button className="report-button" onClick={() => startReport()}>
            <Plus size={18} /> {t.reportButton}
          </button>
          <button
            className="menu-button"
            aria-label={t.menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main className={`workspace ${page !== "map" ? "page-hidden" : ""}`}>
        <aside className="sidebar">
          <div className="sidebar-intro">
            <div className="eyebrow">
              <Sparkles size={13} /> {t.eyebrow}
            </div>
            <h1>
              {t.heroTitle1}
              <br />
              <em>{t.heroTitle2}</em>
            </h1>
            <p>
              {t.heroDesc1}
              <br />
              {t.heroDesc2}
              <br />
              <strong>{t.storageNotice}</strong>
            </p>
          </div>

          <div className="impact-card">
            <div>
              <span className="impact-icon">
                <CircleCheck size={19} />
              </span>
              <span>
                <b>{resolvedCount}</b>
                <small>{t.resolvedCount}</small>
              </span>
            </div>
            <span className="impact-line" />
            <div>
              <b>{ownReports.length}</b>
              <small>{t.reporterCount}</small>
            </div>
          </div>

          <div className="list-heading">
            <div>
              <h2>{t.recentReports}</h2>
              <span>
                {filteredReports.length}
                {t.reportCountSuffix}
              </span>
            </div>
            <button
              onClick={() => {
                setFilter("전체")
                setQuery("")
              }}
            >
              {t.viewAll} <ArrowRight size={15} />
            </button>
          </div>

          <div className="report-list">
            {filteredReports.length ? (
              filteredReports.map((report) => {
                report = localizeReport(report, lang)
                const meta = categoryMeta[report.category]
                const Icon = meta.icon
                return (
                  <button
                    key={report.id}
                    className={`report-row ${
                      selected === report.id ? "selected" : ""
                    }`}
                    onClick={() => selectReport(report)}
                  >
                    <span
                      className="category-icon"
                      style={{ background: meta.soft, color: meta.color }}
                    >
                      <Icon size={19} />
                    </span>
                    <span className="report-copy">
                      <span className="report-top">
                        <b>{report.title}</b>
                        <i style={{ color: meta.color, background: meta.soft }}>
                          {categoryLabel(report.category, lang)}
                        </i>
                      </span>
                      <span className="address">
                        <MapPin size={12} /> {report.address}
                      </span>
                      <span className="meta">
                        {relativeDate(report.reportedAt, lang)}
                        {report.isExample && ` · ${t.exampleTag}`}
                        <i />
                        {statusLabel(report.status, lang)}
                      </span>
                    </span>
                    <ChevronDown className="row-arrow" size={18} />
                  </button>
                )
              })
            ) : (
              <div className="empty">
                {t.emptyTitle}
                <small>{t.emptyDesc}</small>
              </div>
            )}
          </div>
        </aside>

        <section className="map-area">
          <div ref={mapNode} className="map" />
          <div className="map-controls">
            <label className="search-box">
              <Search size={19} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label={t.clearSearch}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <div className="filter-row">
              {(["전체", "보행로", "가로등", "교통", "기타"] as const).map(
                (item) => (
                  <button
                    key={item}
                    className={filter === item ? "active" : ""}
                    onClick={() => setFilter(item)}
                  >
                    {item !== "전체" && (
                      <span style={{ background: categoryMeta[item].color }} />
                    )}
                    {item === "전체" ? t.filterAll : categoryLabel(item, lang)}
                  </button>
                ),
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={importJson}
            />
            <button
              className="tools-toggle"
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((value) => !value)}
            >
              {t.toolsButton} <ChevronDown size={14} />
            </button>
            {toolsOpen && (
              <div className="tools-panel">
                <label>
                  {t.sortLabel}
                  <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "likes")}>
                    <option value="newest">{t.sortNewest}</option>
                    <option value="likes">{t.sortLikes}</option>
                  </select>
                </label>
                <label>
                  {t.statusFilterLabel}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "전체" | ReportStatus)}
                  >
                    <option value="전체">{t.statusAll}</option>
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status, lang)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="data-row">
                  <button onClick={exportCsv}>{t.exportCsv}</button>
                  <button onClick={exportGeojson}>{t.exportGeojson}</button>
                  <button onClick={exportJson}>{t.exportJson}</button>
                  <button onClick={() => fileInputRef.current?.click()}>{t.importJson}</button>
                </div>
              </div>
            )}
          </div>
          <button className="locate-button" onClick={moveToCurrentLocation}>
            <LocateFixed size={19} /> {t.myLocation}
          </button>
          <div className="map-attribution">© OpenStreetMap</div>

          {picking && (
            <div className="pick-banner" role="status">
              <div>
                <b>{t.pickTitle}</b>
                <small>{t.pickDesc}</small>
              </div>
              <div className="pick-actions">
                <button onClick={cancelPick}>{t.pickCancel}</button>
                <button onClick={moveToCurrentLocation}>
                  <LocateFixed size={15} /> {t.pickUseLocation}
                </button>
                <button className="primary" onClick={confirmPick}>
                  {t.pickConfirm} <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {activeReport &&
            filteredReports.some((item) => item.id === activeReport.id) && (
              <article className="map-detail">
                <button
                  className="detail-close"
                  onClick={() => setSelected(null)}
                  aria-label={t.detailClose}
                >
                  <X size={17} />
                </button>
                <div
                  className="detail-label"
                  style={{ color: categoryMeta[activeReport.category].color }}
                >
                  <span
                    style={{
                      background: categoryMeta[activeReport.category].color,
                    }}
                  />{" "}
                  {categoryLabel(activeReport.category, lang)}{" "}
                  {t.detailLabelSuffix}
                </div>
                <h3>{localizeReport(activeReport, lang).title}</h3>
                {activeReport.isExample && (
                  <span className="example-tag">{t.exampleTag}</span>
                )}
                {activeReport.photo && (
                  <img className="detail-photo" src={activeReport.photo} alt={localizeReport(activeReport, lang).title} />
                )}
                <p>{localizeReport(activeReport, lang).description}</p>
                <div className="detail-address">
                  <MapPin size={14} /> {localizeReport(activeReport, lang).address}
                </div>
                <div className="detail-footer">
                  {activeReport.isExample ? (
                    <span className="status">{statusLabel(activeReport.status, lang)}</span>
                  ) : (
                  <label className="status-select">
                    {t.statusField}
                    <select
                      value={activeReport.status}
                      onChange={(e) => changeStatus(activeReport, e.target.value as ReportStatus)}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status, lang)}
                        </option>
                      ))}
                    </select>
                  </label>
                  )}
                  <button
                    className={likedIds.includes(activeReport.id) ? "liked" : ""}
                    aria-pressed={likedIds.includes(activeReport.id)}
                    onClick={() => likeReport(activeReport.id)}
                  >
                    <ThumbsUp size={15} /> {t.likeButton} {activeReport.likes}
                  </button>
                </div>
                <details className="detail-history">
                  <summary>{t.historyTitle}</summary>
                  <ul>
                    {(activeReport.statusHistory ?? []).map((event) => (
                      <li key={`${event.at}-${event.status}`}>
                        {statusLabel(event.status, lang)} · {event.at.slice(0, 10)}
                      </li>
                    ))}
                  </ul>
                </details>
                <div className="detail-actions">
                  <button onClick={() => void copyComplaint(activeReport)}>{t.copyComplaint}</button>
                  <a href="https://www.safetyreport.go.kr/" target="_blank" rel="noreferrer">
                    {t.openSafetyReport}
                  </a>
                </div>
                <small className="detail-note">{t.complaintNote}</small>
                <div className="detail-manage">
                  {!activeReport.isExample && (
                    <button onClick={() => startEdit(activeReport)}>{t.editButton}</button>
                  )}
                  <button
                    className={confirmDelete ? "danger" : ""}
                    onClick={() =>
                      confirmDelete ? deleteReport(activeReport.id) : setConfirmDelete(true)
                    }
                  >
                    {confirmDelete ? t.deleteConfirm : t.deleteButton}
                  </button>
                </div>
              </article>
            )}
        </section>
      </main>

      {page === "news" && (
        <main className="content-page">
          <section className="page-hero news-hero">
            <div className="page-hero-copy">
              <div className="page-eyebrow">
                <Sparkles size={14} /> {t.newsEyebrow}
              </div>
              <h1>
                {t.newsTitle1}
                <br />
                <em>{t.newsTitle2}</em>
              </h1>
              <p>{t.newsDesc}</p>
              <button className="page-primary" onClick={() => navigate("map")}>
                {t.newsCta} <ArrowRight size={18} />
              </button>
            </div>
            <div className="hero-impact">
              <div className="impact-orbit">
                <span className="orbit-dot dot-one" />
                <span className="orbit-dot dot-two" />
                <CircleCheck size={46} />
              </div>
              <b>{resolvedCount}</b>
              <span>{t.resolvedTotal}</span>
              <div className="mini-proof">
                <Users size={16} /> {t.miniProofPrefix} {ownReports.length}
                {t.miniProofSuffix}
              </div>
            </div>
          </section>

          <section className="content-section stats-section">
            <div className="section-heading">
              <div>
                <p>{t.statsEyebrow}</p>
                <h2>{t.statsTitle}</h2>
              </div>
              <span>{t.statsNote}</span>
            </div>
            <div className="stats-grid">
              <article>
                <span className="stat-icon coral">
                  <MessageCircle />
                </span>
                <div>
                  <b>{ownReports.length}</b>
                  <small>{t.statNew}</small>
                </div>
                <i>{t.statExamples}</i>
              </article>
              <article>
                <span className="stat-icon yellow">
                  <School />
                </span>
                <div>
                  <b>{reportedCount}</b>
                  <small>{t.statReported}</small>
                </div>
                <i>{t.statReportedNote}</i>
              </article>
              <article>
                <span className="stat-icon green">
                  <CircleCheck />
                </span>
                <div>
                  <b>{resolvedCount}</b>
                  <small>{t.statResolved}</small>
                </div>
                <i>{t.statExamples}</i>
              </article>
              <article>
                <span className="stat-icon purple">
                  <HeartHandshake />
                </span>
                <div>
                  <b>{ownReports.reduce((sum, report) => sum + report.likes, 0)}</b>
                  <small>{t.statLikes}</small>
                </div>
                <i>{t.statExamples}</i>
              </article>
            </div>
          </section>

          <section className="content-section activity-section">
            <div className="section-heading">
              <div>
                <p>{t.timelineEyebrow}</p>
                <h2>{t.timelineTitle}</h2>
              </div>
            </div>
            <div className="timeline">
              {timelineEvents.map((event) => (
                <article key={`${event.report.id}-${event.at}-${event.status}`}>
                  <span
                    className={`timeline-dot ${
                      event.status === "처리 완료" ? "green" : event.status === "신고함" ? "purple" : "coral"
                    }`}
                  />
                  <time>{relativeDate(event.at, lang)}</time>
                  <div>
                    <b>{localizeReport(event.report, lang).title}</b>
                    <small>{statusLabel(event.status, lang)}</small>
                  </div>
                </article>
              ))}
              {timelineEvents.length === 0 && (
                <article>
                  <span className="timeline-dot coral" />
                  <time>{t.timelineEmptyTime}</time>
                  <div>
                    <b>{t.timelineEmptyTitle}</b>
                    <small>{t.timelineEmptyDesc}</small>
                  </div>
                </article>
              )}
            </div>
          </section>

          <section className="page-cta">
            <div>
              <p>{t.ctaEyebrow}</p>
              <h2>{t.ctaTitle}</h2>
            </div>
            <button onClick={() => startReport()}>
              <Plus size={18} /> {t.reportButton}
            </button>
          </section>
          <PageFooter navigate={navigate} t={t} />
        </main>
      )}

      {page === "about" && (
        <main className="content-page">
          <section className="page-hero about-hero">
            <div className="page-hero-copy">
              <div className="page-eyebrow">
                <HeartHandshake size={14} /> {t.aboutEyebrow}
              </div>
              <h1>
                {t.aboutTitle1}
                <br />
                <em>{t.aboutTitle2}</em>
              </h1>
              <p>
                {t.aboutDesc}
                <br />
                <strong>{t.storageNotice}</strong>
              </p>
              <div className="hero-buttons">
                <button
                  className="page-primary"
                  onClick={() => navigate("map")}
                >
                  {t.aboutCta1} <Navigation size={17} />
                </button>
                <button
                  className="page-secondary"
                  onClick={() => startReport()}
                >
                  {t.aboutCta2}
                </button>
              </div>
            </div>
            <div className="mission-graphic">
              <div className="mission-center">
                <ShieldCheck size={42} />
              </div>
              <div className="mission-node node-eye">
                <Eye />
                <span>{t.missionDiscover}</span>
              </div>
              <div className="mission-node node-map">
                <MapPin />
                <span>{t.missionRecord}</span>
              </div>
              <div className="mission-node node-heart">
                <HeartHandshake />
                <span>{t.missionChange}</span>
              </div>
              <span className="mission-path path-one" />
              <span className="mission-path path-two" />
              <span className="mission-path path-three" />
            </div>
          </section>

          <section className="content-section why-section">
            <div className="why-quote">
              <span>“</span>
              <blockquote>{t.quoteText}</blockquote>
              <p>{t.quoteExample}</p>
            </div>
            <div className="why-copy">
              <p>{t.whyEyebrow}</p>
              <h2>
                {t.whyTitle1}
                <br />
                {t.whyTitle2}
              </h2>
              <p className="body-copy">{t.whyBody}</p>
            </div>
          </section>

          <section className="content-section steps-section">
            <div className="center-heading">
              <p>{t.howEyebrow}</p>
              <h2>{t.howTitle}</h2>
              <span>{t.howDesc}</span>
            </div>
            <div className="steps-grid">
              <article>
                <i>01</i>
                <span className="step-icon">
                  <Footprints />
                </span>
                <h3>{t.step1Title}</h3>
                <p>{t.step1Desc}</p>
              </article>
              <ArrowRight className="step-arrow" />
              <article>
                <i>02</i>
                <span className="step-icon">
                  <MapPin />
                </span>
                <h3>{t.step2Title}</h3>
                <p>{t.step2Desc}</p>
              </article>
              <ArrowRight className="step-arrow" />
              <article>
                <i>03</i>
                <span className="step-icon">
                  <Sparkles />
                </span>
                <h3>{t.step3Title}</h3>
                <p>{t.step3Desc}</p>
              </article>
            </div>
          </section>

          <section className="content-section principles-section">
            <div className="section-heading">
              <div>
                <p>{t.principlesEyebrow}</p>
                <h2>{t.principlesTitle}</h2>
              </div>
            </div>
            <div className="principle-grid">
              <article>
                <ShieldCheck />
                <h3>{t.principle1Title}</h3>
                <p>{t.principle1Desc}</p>
              </article>
              <article>
                <Users />
                <h3>{t.principle2Title}</h3>
                <p>{t.principle2Desc}</p>
              </article>
              <article>
                <Eye />
                <h3>{t.principle3Title}</h3>
                <p>{t.principle3Desc}</p>
              </article>
              <article>
                <Lightbulb />
                <h3>{t.principle4Title}</h3>
                <p>{t.principle4Desc}</p>
              </article>
            </div>
          </section>

          <section className="page-cta about-cta">
            <div>
              <p>{t.aboutCtaEyebrow}</p>
              <h2>{t.aboutCtaTitle}</h2>
            </div>
            <button onClick={() => startReport()}>
              {t.startNow} <ArrowRight size={18} />
            </button>
          </section>
          <PageFooter navigate={navigate} t={t} />
        </main>
      )}

      {isFormOpen && draft && (
        <div className="modal-backdrop" onMouseDown={() => setIsFormOpen(false)}>
          <div
            className="report-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={draft.id ? t.editTitle : t.reportButton}
            ref={modalRef}
          >
            <button
              className="modal-close"
              aria-label={t.pickCancel}
              onClick={() => setIsFormOpen(false)}
            >
              <X size={20} />
            </button>
            <div className="modal-icon">
              <MessageCircle size={23} />
            </div>
            <p className="modal-kicker">{t.modalKicker}</p>
            <h2>{draft.id ? t.editTitle : t.modalTitle}</h2>
            <form onSubmit={submitDraft}>
              <div className="form-location">
                <span>
                  <MapPin size={14} /> {t.locationLabel}: {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false)
                    setPicking(true)
                    map.current?.setView([draft.lat, draft.lng])
                  }}
                >
                  {t.locationChange}
                </button>
              </div>
              <label>
                {t.formTitle}
                <input
                  required
                  maxLength={45}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder={t.formTitlePlaceholder}
                />
              </label>
              <label>
                {t.formCategory}
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
                >
                  {(["보행로", "가로등", "교통", "기타"] as Category[]).map((category) => (
                    <option key={category} value={category}>
                      {categoryLabel(category, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.formAddress}
                <input
                  required
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  placeholder={t.formAddressPlaceholder}
                />
              </label>
              <label>
                {t.formDescription}
                <textarea
                  required
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder={t.formDescriptionPlaceholder}
                />
              </label>
              <label>
                {t.photoLabel}
                <input type="file" accept="image/*" onChange={(e) => void onPhoto(e)} />
              </label>
              <small className="photo-note">{t.photoNote}</small>
              {draft.photo && (
                <div className="photo-preview">
                  <img src={draft.photo} alt="" />
                  <button type="button" onClick={() => setDraft({ ...draft, photo: "" })}>
                    {t.photoRemove}
                  </button>
                </div>
              )}
              <div className="form-note">
                <ShieldCheck size={16} /> {t.formNote}
              </div>
              <button className="submit-button" type="submit">
                {draft.id ? t.editSubmit : t.formSubmit} <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {notice && (
        <div className="toast" role="status">
          <CircleCheck size={18} /> {notice}
        </div>
      )}
    </div>
  )
}

export default App
