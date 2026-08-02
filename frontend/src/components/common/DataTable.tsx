import { useState, type ReactNode } from 'react'

interface Column<T> {
  key: string
  label: string
  render?: (row: T, index: number) => ReactNode
  sortable?: boolean
  sortKey?: string
  align?: 'left' | 'center' | 'right'
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
  defaultSortKey?: string
  defaultSortAsc?: boolean
}

export default function DataTable<T>({ columns, data, keyExtractor, onRowClick, emptyMessage = 'No data', className = '', defaultSortKey, defaultSortAsc }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null)
  const [sortAsc, setSortAsc] = useState(defaultSortAsc ?? true)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const col = columns.find(c => c.key === sortKey)
        const resolvedKey = col?.sortKey ?? sortKey
        const aVal = (a as Record<string, unknown>)[resolvedKey]
        const bVal = (b as Record<string, unknown>)[resolvedKey]
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortAsc ? aVal - bVal : bVal - aVal
        }
        return sortAsc
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal))
      })
    : data

  const alignClass = (align?: string) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <div className={`bg-white/[0.04] border border-white/[0.08] rounded-xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={`px-4 py-3 text-[10px] uppercase tracking-[2px] font-medium ${
                    sortKey === col.key ? 'text-accent' : 'text-gray-600'
                  } ${alignClass(col.align)} ${col.sortable ? 'cursor-pointer hover:text-gray-400' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-600">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-white/[0.03] ${onRowClick ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
                >
                  {columns.map(col => (
                    <td key={col.key} className={`px-4 py-3 text-sm ${alignClass(col.align)}`}>
                      {col.render
                        ? col.render(row, i)
                        : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
