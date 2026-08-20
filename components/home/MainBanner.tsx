import { MainBannerSlider } from "@/components/home/MainBannerSlider";
import { getHomeBanners } from "@/lib/repositories/banners";

export async function MainBanner() {
  const slides = await getHomeBanners();
  return <MainBannerSlider slides={slides} />;
}
