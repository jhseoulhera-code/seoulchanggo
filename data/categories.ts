import {
  Baby,
  Car,
  House,
  MonitorSmartphone,
  PawPrint,
  PenLine,
  Puzzle,
  ShoppingBag,
  Sofa,
  Utensils,
} from "lucide-react";
import type { Category } from "@/types";

export const categories: Category[] = [
  { id: "goods", label: "잡화", icon: ShoppingBag },
  { id: "baby", label: "출산/유아동", icon: Baby },
  { id: "kitchen", label: "주방용품", icon: Utensils },
  { id: "living", label: "생활용품", icon: House },
  { id: "interior", label: "홈인테리어", icon: Sofa },
  { id: "digital", label: "가전디지털", icon: MonitorSmartphone },
  { id: "car", label: "자동차용품", icon: Car },
  { id: "hobby", label: "완구/취미", icon: Puzzle },
  { id: "stationery", label: "문구/오피스", icon: PenLine },
  { id: "pet", label: "반려동물", icon: PawPrint },
];
