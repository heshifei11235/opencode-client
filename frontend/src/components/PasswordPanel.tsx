import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Lock, Unlock, Plus, Trash2, Copy, Eye, EyeOff, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PasswordEntry } from '@/types'

export default function PasswordPanel() {
  const { passwords, setPasswords, addPassword, removePassword, authStatus, setAuthStatus } = useAppStore()
  const [masterPassword, setMasterPassword] = useState('')
  const [showPassword, setShowPassword] = useState<number | null>(null)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, string>>({})
  const [showAddDialog, setShowAddDialog] = useState(false)

  // New password form
  const [newCategory, setNewCategory] = useState<'website' | 'app' | 'email'>('website')
  const [newName, setNewName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const handleUnlock = async () => {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword })
      })

      if (res.ok) {
        setAuthStatus({ ...authStatus, is_unlocked: true })
        fetchPasswords()
      } else {
        alert('Invalid password')
      }
    } catch (err) {
      console.error('Failed to verify:', err)
    }
  }

  const handleSetupMasterPassword = async () => {
    if (!masterPassword.trim()) return

    try {
      await fetch('/api/auth/master-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword })
      })
      setAuthStatus({ has_master_password: true, is_unlocked: true })
      setShowAddDialog(true)
    } catch (err) {
      console.error('Failed to set master password:', err)
    }
  }

  const fetchPasswords = async () => {
    try {
      const res = await fetch('/api/passwords')
      const data = await res.json()
      setPasswords(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch passwords:', err)
    }
  }

  const handleAddPassword = async () => {
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) return

    try {
      const res = await fetch('/api/passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          name: newName,
          username: newUsername,
          password: newPassword,
          url: newUrl || null,
          notes: newNotes || null
        })
      })
      const data = await res.json()
      addPassword(data)
      resetForm()
      setShowAddDialog(false)
    } catch (err) {
      console.error('Failed to add password:', err)
    }
  }

  const resetForm = () => {
    setNewCategory('website')
    setNewName('')
    setNewUsername('')
    setNewPassword('')
    setNewUrl('')
    setNewNotes('')
  }

  const handleRevealPassword = async (id: number) => {
    if (showPassword === id) {
      setShowPassword(null)
      return
    }

    try {
      const res = await fetch(`/api/passwords/${id}`)
      const data = await res.json()
      setRevealedPasswords({ ...revealedPasswords, [id]: data.password })
      setShowPassword(id)
    } catch (err) {
      console.error('Failed to reveal password:', err)
    }
  }

  const handleCopyPassword = async (id: number) => {
    try {
      const res = await fetch(`/api/passwords/${id}`)
      const data = await res.json()
      await navigator.clipboard.writeText(data.password)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDeletePassword = async (id: number) => {
    if (!confirm('Delete this password?')) return

    try {
      await fetch(`/api/passwords/${id}`, { method: 'DELETE' })
      removePassword(id)
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  // Lock screen
  if (!authStatus.is_unlocked) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 w-80">
          <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">
            {authStatus.has_master_password ? 'Unlock Passwords' : 'Set Master Password'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {authStatus.has_master_password
              ? 'Enter your master password to view your passwords'
              : 'Create a master password to encrypt your passwords'}
          </p>
          <input
            type="password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (
              authStatus.has_master_password ? handleUnlock() : handleSetupMasterPassword()
            )}
            placeholder="Master password"
            className="w-full px-4 py-2 rounded-md border bg-background"
          />
          <button
            onClick={authStatus.has_master_password ? handleUnlock : handleSetupMasterPassword}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {authStatus.has_master_password ? 'Unlock' : 'Set Password'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Unlock className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Passwords</h2>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Password list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {passwords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <KeyRound className="w-12 h-12 mb-2" />
            <p>No passwords yet</p>
            <p className="text-sm">Click Add to store your first password</p>
          </div>
        ) : (
          passwords.map((entry) => (
            <PasswordItem
              key={entry.id}
              entry={entry}
              revealedPassword={showPassword === entry.id ? revealedPasswords[entry.id] : null}
              onReveal={() => handleRevealPassword(entry.id)}
              onCopy={() => handleCopyPassword(entry.id)}
              onDelete={() => handleDeletePassword(entry.id)}
            />
          ))
        )}
      </div>

      {/* Add dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[480px] max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-lg font-semibold">Add Password</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as 'website' | 'app' | 'email')}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-md border bg-background"
                >
                  <option value="website">Website</option>
                  <option value="app">Application</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Google"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-md border bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Username / Email</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="user@example.com"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-md border bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-md border bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">URL (optional)</label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://google.com"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-md border bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Additional notes..."
                  className="mt-1 w-full px-3 py-2 text-sm rounded-md border bg-background resize-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAddDialog(false); resetForm() }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPassword}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PasswordItem({
  entry,
  revealedPassword,
  onReveal,
  onCopy,
  onDelete
}: {
  entry: PasswordEntry
  revealedPassword: string | null
  onReveal: () => void
  onCopy: () => void
  onDelete: () => void
}) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs px-2 py-0.5 rounded',
              entry.category === 'website' && 'bg-blue-100 text-blue-700',
              entry.category === 'app' && 'bg-purple-100 text-purple-700',
              entry.category === 'email' && 'bg-green-100 text-green-700'
            )}>
              {entry.category}
            </span>
            <span className="font-medium truncate">{entry.name}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate mt-1">{entry.username}</p>
          {revealedPassword && (
            <p className="text-sm font-mono mt-1">{revealedPassword}</p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={onReveal}
            className="p-1.5 hover:bg-muted rounded"
            title={revealedPassword ? 'Hide' : 'Reveal'}
          >
            {revealedPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={onCopy}
            className="p-1.5 hover:bg-muted rounded"
            title="Copy password"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-muted hover:text-destructive rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {entry.url && (
        <p className="text-xs text-muted-foreground mt-2 truncate">{entry.url}</p>
      )}
    </div>
  )
}
