import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { NoticeListClient } from "@/components/notices/NoticeListClient";
import { getNotices } from "@/lib/repositories/notices";

export default async function NoticesPage() {
  const notices = await getNotices();

  return (
    <>
      <ListHeader title="공지사항" hideCartIcon />
      <main className="pb-24 md:pb-10">
        <PageContainer className="pt-2">
          <NoticeListClient notices={notices} />
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
