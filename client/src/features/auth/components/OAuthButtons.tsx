import React from 'react'
import { Button } from '@/components/ui/button'
import { API_BASE_URL } from '@/lib/apiConfig'

export const OAuthButtons: React.FC = () => {
  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google`
  }


  return (
    <div className="w-full">
      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleLogin}
        className="w-full flex items-center justify-center gap-2 border-border hover:bg-muted font-medium"
      >
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
          />
          <path
            fill="#FBBC05"
            d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
          />
          <path
            fill="#34A853"
            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 20.4 7.5 23 12 23z"
          />
        </svg>
        <span>Google</span>
      </Button>
    </div>
  )
}
