import { OwnerSidebar } from "@/components/owner/sidebar";

export default function OwnerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            <OwnerSidebar />
            <main className="flex-1 p-8 bg-gradient-to-br from-background via-background to-primary/[0.03]">
                {children}
            </main>
        </div>
    );
}
