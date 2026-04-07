import type { Metadata } from "next"
import Image from "next/image"
import { Geist, Geist_Mono } from "next/font/google"
import logo from "../../assets/logo.png"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
})

export const metadata: Metadata = {
  title: "Repo to Prompt",
  description: "Generate rich LLM context directly from your repository."
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="flex min-h-screen flex-col bg-slate-50">
          <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2">
                <div className="relative h-7 w-7 overflow-hidden rounded-lg bg-slate-900 shadow-sm shadow-slate-300">
                  <Image
                    src={logo}
                    alt="Repo to Prompt logo"
                    className="h-full w-full object-contain"
                    priority
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold tracking-tight text-slate-900">
                    Repo to Prompt
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Turn your codebase into LLM-ready context
                  </span>
                </div>
              </div>
              <div className="hidden sm:flex">
                <a
                  href="https://github.com/adityadav1220/repo-to-prompt"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                >
                  View on GitHub
                </a>
              </div>
            </div>
          </header>

          <main className="flex-1 pt-14 pb-20">
            {children}
          </main>

          <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Context generator designed for modern LLM workflows.
              </span>
              <span className="text-[11px] text-slate-500">
                Built for local-first analysis. Keep secrets on your machine.
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
