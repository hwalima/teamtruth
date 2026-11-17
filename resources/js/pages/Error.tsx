import { Head, Link } from '@inertiajs/react';

interface ErrorPageProps {
    status: number;
    message: string;
}

export default function ErrorPage({ status, message }: ErrorPageProps) {
    return (
        <>
            <Head title={`Error ${status}`} />
            <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
                <section className="w-full max-w-lg space-y-5 text-center">
                    <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        Error {status}
                    </p>
                    <h1 className="text-3xl font-semibold">We couldn’t complete that request.</h1>
                    <p className="text-muted-foreground">{message}</p>
                    <Link
                        href="/"
                        className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    >
                        Return to the app
                    </Link>
                </section>
            </main>
        </>
    );
}
