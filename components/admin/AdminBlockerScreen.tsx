import { AlertTriangle, Ban, PlugZap } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { PageContainer } from "@/components/common/PageContainer";

type AdminBlockerScreenProps = {
  icon: LucideIcon;
  title: string;
  message: string;
  linkHref?: string;
  linkLabel?: string;
};

function AdminBlockerScreen({ icon: Icon, title, message, linkHref, linkLabel }: AdminBlockerScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <PageContainer className="flex max-w-md flex-col items-center gap-4 text-center">
        <Icon size={36} className="text-text-secondary" />
        <h1 className="text-base font-bold text-text-main">{title}</h1>
        <p className="text-sm text-text-secondary">{message}</p>
        {linkHref && linkLabel && (
          <Link href={linkHref} className="border border-primary px-4 py-2 text-sm font-bold text-primary">
            {linkLabel}
          </Link>
        )}
      </PageContainer>
    </main>
  );
}

export function AdminNotConfiguredScreen() {
  return (
    <AdminBlockerScreen
      icon={PlugZap}
      title="Supabase 연결이 필요합니다"
      message="관리자 기능은 실제 Supabase 프로젝트가 연결된 뒤에만 사용할 수 있습니다. 이 환경에는 아직 자격증명이 설정되어 있지 않습니다."
      linkHref="/"
      linkLabel="쇼핑몰로 돌아가기"
    />
  );
}

export function AdminForbiddenScreen() {
  return (
    <AdminBlockerScreen
      icon={Ban}
      title="관리자 권한이 없습니다"
      message="이 계정은 관리자로 지정되어 있지 않습니다. 관리자 권한이 필요하면 운영자에게 문의해주세요."
      linkHref="/"
      linkLabel="쇼핑몰로 돌아가기"
    />
  );
}

export function AdminErrorScreen({ message }: { message: string }) {
  return <AdminBlockerScreen icon={AlertTriangle} title="일시적인 오류가 발생했습니다" message={message} />;
}
