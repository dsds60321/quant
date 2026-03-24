import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ui-shell">
      <div className="w-full overflow-hidden bg-[#eef2f6] min-h-screen">
        <Header />
        <div className="flex min-h-[calc(100vh-64px)]">
          <Sidebar />
          <main className="min-w-0 flex-1 p-3 lg:p-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
