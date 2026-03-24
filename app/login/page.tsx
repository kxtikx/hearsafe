// app/login/page.tsx
"use client"

import { useState, useEffect } from "react"
import { Ear, Volume2, Stethoscope, AudioLines } from "lucide-react"
import { WaveBackground } from "@/components/common/Wave-background"
import TextType from '@/components/ui/TextType'
import AuthForm from "@/components/AuthForm"

export default function LoginPage() {
    const [currentIcon, setCurrentIcon] = useState(0)

    const icons = [
        <Ear key="ear" className="w-24 h-24 text-primary animate-pulse" />,
        <Volume2 key="volume" className="w-24 h-24 text-primary animate-pulse" />,
        <Stethoscope key="stethoscope" className="w-24 h-24 text-primary animate-pulse" />,
    ]

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIcon((prev) => (prev + 1) % icons.length)
        }, 3000)

        return () => clearInterval(interval)
    }, [icons.length])

    return (
        <div className="min-h-screen flex">
            <WaveBackground />

            {/* Left side - Dynamic icon */}
            <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-white/20 dark:bg-black/20 backdrop-blur-xs">
                <div className="flex flex-col items-center justify-center space-y-6">
                    <span>
                        <AudioLines className="w-14 h-14" />
                    </span>
                    <h2 className="text-2xl font-bold text-foreground text-center max-w-xs">
                        <TextType
                            text={["Welcome back to HearSafe. Continue your hearing health journey."]}
                            typingSpeed={75}
                            pauseDuration={1500}
                            showCursor={true}
                            cursorCharacter="|"
                            variableSpeed={false}
                            onSentenceComplete={() => { }}
                        />
                    </h2>
                </div>
            </div>

            {/* Right side - Login form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white/10 dark:bg-black/10 backdrop-blur-xs">
                <AuthForm type="sign-in" />
            </div>
        </div>
    )
}