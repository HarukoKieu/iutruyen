import React, { useState, useRef, useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Loader2 } from 'lucide-react'
import { useSearchSuggestions, useDeleteSearchHistory } from '../hooks/useSearch'
import { SearchSuggestionsDropdown } from './SearchSuggestionsDropdown'

interface SearchBarProps {
  className?: string
  placeholder?: string
}

export const SearchBar: React.FC<SearchBarProps> = ({
  className = '',
  placeholder = 'Nhập tên truyện, tác giả,...',
}) => {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const suggestionsId = useId()
  const navigate = useNavigate()

  const { data: suggestionsData, isLoading } = useSearchSuggestions(query, isOpen)
  const { mutate: deleteSearchHistory } = useDeleteSearchHistory()

  // Phím tắt "/" để focus ô tìm kiếm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        !(document.activeElement as HTMLElement | null)?.isContentEditable &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsOpen(false)
    inputRef.current?.blur()
    if (query.trim()) {
      navigate('/search?q=' + encodeURIComponent(query.trim()))
    }
  }

  const handleSelectQuery = (selectedQuery: string) => {
    setQuery(selectedQuery)
    setIsOpen(false)
    inputRef.current?.blur()
    navigate('/search?q=' + encodeURIComponent(selectedQuery.trim()))
  }

  const handleDeleteHistoryItem = (itemQuery: string) => {
    deleteSearchHistory(itemQuery)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return
    const history = suggestionsData?.history ?? []
    const suggestions = suggestionsData?.suggestions ?? []
    const stories = suggestionsData?.stories ?? []
    const trending = !query.trim() ? suggestionsData?.trending ?? [] : []
    const queries = [...history, ...suggestions]
    const totalItems = queries.length + stories.length + trending.length + (query.trim() ? 1 : 0)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!totalItems) return
      setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!totalItems) return
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex < 0 || selectedIndex >= totalItems) {
        handleSearchSubmit()
      } else if (selectedIndex < queries.length) {
        handleSelectQuery(queries[selectedIndex])
      } else if (selectedIndex < queries.length + stories.length) {
        setIsOpen(false)
        inputRef.current?.blur()
        navigate(`/stories/${stories[selectedIndex - queries.length].slug}`)
      } else {
        handleSelectQuery(trending[selectedIndex - queries.length - stories.length] ?? query)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div
      ref={containerRef}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false) }}
      className={`relative w-full min-w-0 max-w-[280px] ${className}`}
    >
      <form onSubmit={handleSearchSubmit} autoComplete="off" className="relative w-full">
        <div className="relative flex items-center rounded-full border border-border/80 bg-muted/40 hover:bg-muted/60 focus-within:border-primary/60 focus-within:bg-card focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-150">
          <input
            ref={inputRef}
            id={`${suggestionsId}-input`}
            role="combobox"
            aria-label="Tìm kiếm truyện"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={isOpen ? suggestionsId : undefined}
            aria-activedescendant={isOpen && selectedIndex >= 0 ? `${suggestionsId}-${selectedIndex}` : undefined}
            name="novel_search_input"
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setSelectedIndex(-1) }}
            onFocus={() => { setIsFocused(true); setIsOpen(true) }}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            className="w-full h-9 rounded-full bg-transparent pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {isLoading && query.trim() ? (
              <Loader2 className="h-4 w-4 animate-spin text-link" />
            ) : (
              <Search className={`h-4 w-4 transition-colors ${isFocused ? 'text-link' : 'text-muted-foreground'}`} />
            )}
          </div>

          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSelectedIndex(-1); inputRef.current?.focus() }}
              className="absolute right-9 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="h-3 w-3" />
            </button>
          )}

          {!isFocused && !query && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center rounded border border-border/60 bg-muted/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              /
            </kbd>
          )}

          {isFocused && query && (
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
              title="Tìm kiếm"
            >
              <Search className="h-3 w-3" />
            </button>
          )}
        </div>
      </form>

      {isOpen && (
        <SearchSuggestionsDropdown
          query={query}
          id={suggestionsId}
          suggestionsData={suggestionsData}
          isLoading={isLoading}
          selectedIndex={selectedIndex}
          onSelectQuery={handleSelectQuery}
          onDeleteHistoryItem={handleDeleteHistoryItem}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
