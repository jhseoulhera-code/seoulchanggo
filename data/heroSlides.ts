import { Car, House, PawPrint, Utensils } from "lucide-react";
import type { HeroSlide } from "@/types";

export const heroSlides: HeroSlide[] = [
  {
    id: "living",
    title: "생활을 더 편리하게",
    subtitle: "오늘의 생활 필수품",
    ctaLabel: "지금 보기",
    background: "#eaf5f3",
    icon: House,
  },
  {
    id: "kitchen",
    title: "주방을 새롭게",
    subtitle: "인기 주방용품 모음전",
    ctaLabel: "지금 보기",
    background: "#f3f1ec",
    icon: Utensils,
  },
  {
    id: "pet",
    title: "반려동물과 함께",
    subtitle: "반려동물 생활 필수템",
    ctaLabel: "지금 보기",
    background: "#eff2f5",
    icon: PawPrint,
  },
  {
    id: "car",
    title: "자동차 생활용품",
    subtitle: "차량용 필수 아이템 모음",
    ctaLabel: "지금 보기",
    background: "#f5eff0",
    icon: Car,
  },
];
