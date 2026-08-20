import type { Inquiry } from "@/types";

export const inquiries: Inquiry[] = [
  {
    id: "inquiry-1",
    author: "구매예정**",
    date: "2026.07.10",
    status: "answered",
    question: "해외에서 발송되는 상품인가요, 국내 재고 상품인가요?",
    answer: "안녕하세요. 상품 상세페이지의 배송정보 영역에서 확인하실 수 있으며, 해당 상품은 배송방식에 표기된 대로 발송됩니다. 감사합니다.",
  },
  {
    id: "inquiry-2",
    author: "user_23**",
    date: "2026.07.05",
    status: "answered",
    question: "색상 옵션 변경이 가능한가요?",
    answer: "네, 옵션 선택 영역에서 원하시는 색상을 선택해주시면 됩니다. 재고 상황에 따라 일부 색상은 품절될 수 있는 점 참고 부탁드립니다.",
  },
  {
    id: "inquiry-3",
    author: "쇼핑중**",
    date: "2026.06.29",
    status: "pending",
    question: "대량 구매 시 할인이 가능할까요?",
  },
  {
    id: "inquiry-4",
    author: "home_deco**",
    date: "2026.06.22",
    status: "answered",
    question: "구성품에 별도 부속품이 포함되어 있나요?",
    answer: "네, 상품정보 탭의 구성품 항목에 포함 부속품을 안내드리고 있습니다. 참고 부탁드립니다.",
  },
  {
    id: "inquiry-5",
    author: "새내기맘**",
    date: "2026.06.15",
    status: "pending",
    question: "지금 주문하면 실제 도착까지 며칠 정도 걸리나요?",
  },
];
