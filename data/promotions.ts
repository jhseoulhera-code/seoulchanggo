import { Car, House, PawPrint, Utensils } from "lucide-react";
import type { Promotion } from "@/types";

export const promotions: Promotion[] = [
  {
    id: "newlywed",
    title: "신혼/이사 생활용품",
    subtitle: "새 출발 필수템 모음",
    background: "#eaf5f3",
    icon: House,
  },
  {
    id: "kitchen-essentials",
    title: "주방 필수템",
    subtitle: "요리가 즐거워지는 도구",
    background: "#f3f1ec",
    icon: Utensils,
  },
  {
    id: "pet-picks",
    title: "반려동물 추천",
    subtitle: "우리 아이 맞춤 케어",
    background: "#eff2f5",
    icon: PawPrint,
  },
  {
    id: "car-life",
    title: "자동차 생활용품",
    subtitle: "드라이브를 더 편하게",
    background: "#f5eff0",
    icon: Car,
  },
];
