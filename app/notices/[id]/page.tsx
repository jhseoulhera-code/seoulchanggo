import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { NoticeDetailClient } from "@/components/notices/NoticeDetailClient";
import { getNoticeById } from "@/lib/repositories/notices";

export default async function NoticeDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const notice = await getNoticeById(id);

  if (!notice) {
    notFound();
  }

  return (
    <>
      <ListHeader title="공지사항" hideCartIcon />
      <main className="pb-24 md:pb-10">
        <PageContainer className="pt-4">
          <NoticeDetailClient notice={notice} />
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
