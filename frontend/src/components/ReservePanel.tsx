import { useAppStore } from '@/stores/appStore'

export default function ReservePanel() {
  const { activeView } = useAppStore()

  return (
    <aside className="w-72 border-l bg-muted/20 flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-muted-foreground">Reserve Panel</h2>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Reserved for future use</p>
          <p className="text-xs mt-1">
            {activeView === 'chat'
              ? 'Chat analytics or visualization may appear here'
              : 'Password insights or trends may appear here'}
          </p>
        </div>
      </div>
    </aside>
  )
}
