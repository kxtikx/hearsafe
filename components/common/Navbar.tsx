"use client"

import * as React from "react"
import Link from "next/link"
import { LogIn, UserPlus, LogOut, Menu, X, AudioWaveform } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { onAuthStateChanged, signOut, User } from "firebase/auth"
import { auth } from "@/lib/firebase/client"
import { ThemeToggle } from "@/components/common/theme-provider"

export function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      localStorage.removeItem("qaData")
      localStorage.removeItem("analysisResult")
      router.push("/login")
      setMenuOpen(false)
    } catch (err) {
      console.error("Sign out error:", err)
    }
  }

  const navLinks = [
    { href: "/", label: "Home", show: true },
    { href: "/about-us", label: "About Us", show: true },
    { href: "/results", label: "Results", show: !!user },
    { href: "/test-history", label: "History", show: !!user },
    { href: "/contact-support", label: "Contact", show: true },
  ]

  return (
    <div className="fixed top-0 left-0 w-full z-50 border-b border-white/10 bg-black/30 backdrop-blur-md">
      {/* Main navbar row */}
      <div className="flex items-center justify-between h-16 px-4 md:px-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <AudioWaveform className="h-5 w-5" />
          <span className="text-xl font-bold">HearSafe</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.filter(l => l.show).map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-foreground/80 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3">
          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                    {user.displayName ?? user.email}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1 hover:underline text-sm text-foreground/80"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <>
                  <Link href="/sign-up" className="flex items-center gap-1 hover:underline text-sm text-foreground/80">
                    <UserPlus className="h-4 w-4" />
                    Sign Up
                  </Link>
                  <Link href="/login" className="flex items-center gap-1 hover:underline text-sm text-foreground/80">
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                </>
              )}
            </>
          )}
          <ThemeToggle />
        </div>

        {/* Mobile right side: theme toggle + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur-md px-4 py-4 flex flex-col gap-2">
          {navLinks.filter(l => l.show).map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2.5 text-sm rounded-md hover:bg-accent transition-colors text-foreground/80 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}

          <div className="border-t mt-2 pt-3">
            {!loading && (
              <>
                {user ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-muted-foreground px-3 truncate">
                      {user.displayName ?? user.email}
                    </span>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm rounded-md hover:bg-accent transition-colors text-foreground/80 w-full text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link
                      href="/sign-up"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm rounded-md hover:bg-accent transition-colors text-foreground/80"
                    >
                      <UserPlus className="h-4 w-4" />
                      Sign Up
                    </Link>
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm rounded-md hover:bg-accent transition-colors text-foreground/80"
                    >
                      <LogIn className="h-4 w-4" />
                      Login
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}