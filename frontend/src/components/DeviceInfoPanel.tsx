import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Server, Globe, Shield, Network, Wifi, Loader2, MapPin, Box, ChevronRight, X, Copy, Check } from 'lucide-react'

export default function DeviceInfoPanel() {
  const {
    currentDevices,
    activeDeviceId,
    deviceDetails,
    setDeviceDetail,
    deviceDetailLoading,
    setDeviceDetailLoading,
    activeDocumentId
  } = useAppStore()

  const [showDetailModal, setShowDetailModal] = useState(false)

  const activeDevice = currentDevices.find(d => d.id === activeDeviceId)
  const detail = activeDeviceId ? deviceDetails[activeDeviceId] : null
  const loading = activeDeviceId ? deviceDetailLoading[activeDeviceId] : false

  // Fetch device details when device is selected
  useEffect(() => {
    if (!activeDeviceId || detail || loading || !activeDocumentId) return

    const fetchDeviceDetail = async () => {
      setDeviceDetailLoading(activeDeviceId, true)
      try {
        // activeDocumentId is in format "projectId_filename"
        const docParts = activeDocumentId.split('_')
        const projectId = parseInt(docParts[0], 10)
        const filename = docParts.slice(1).join('_')

        const res = await fetch(`/api/devices/detail?device_id=${encodeURIComponent(activeDeviceId)}&project_id=${projectId}&filename=${encodeURIComponent(filename)}`)
        if (res.ok) {
          const data = await res.json()
          setDeviceDetail(activeDeviceId, data)
        } else {
          setDeviceDetail(activeDeviceId, {
            id: activeDeviceId,
            device_name: `Device ${activeDeviceId}`,
            device_type: 'Server',
            device_status: 'Online',
            device_location: 'Data Center A',
            device_ip: '192.168.1.' + Math.floor(Math.random() * 255),
            device_port: 4096,
            device_username: 'admin',
            device_password: '********',
            device_ssh_port: 22,
            device_ssh_username: 'root'
          })
        }
      } catch (err) {
        console.error('Failed to fetch device detail:', err)
      } finally {
        setDeviceDetailLoading(activeDeviceId, false)
      }
    }

    fetchDeviceDetail()
  }, [activeDeviceId, detail, loading, setDeviceDetail, setDeviceDetailLoading, activeDocumentId])

  if (!activeDevice) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-gradient-to-b from-slate-50 via-white to-slate-100 p-6">
        {/* 3D placeholder */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 rounded-2xl blur-xl opacity-50" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-xl border border-slate-200/50">
            <Server className="w-10 h-10 text-slate-400" />
          </div>
        </div>
        <p className="mt-6 text-lg font-semibold text-slate-600">未选择设备</p>
        <p className="mt-2 text-sm text-slate-400 text-center max-w-[200px]">
          从左侧选择一个设备查看详情
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-50 to-white">
      {/* Header with 3D card effect */}
      <div className="px-5 py-4 border-b border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-white">
        <div className="relative">
          {/* 3D shadow layers */}
          <div className="absolute -inset-1 bg-gradient-to-r from-slate-200 via-transparent to-transparent rounded-xl blur-sm opacity-50" />

          <div className="relative flex items-center justify-between p-4 bg-white rounded-xl shadow-lg border border-slate-100/80">
            {/* Device icon with risk color */}
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center shadow-lg
              ${activeDevice.risk_level === 'very-high' ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/30' :
                activeDevice.risk_level === 'high' ? 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-orange-500/30' :
                activeDevice.risk_level === 'medium' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-yellow-500/30' :
                'bg-gradient-to-br from-blue-500 to-purple-600 shadow-blue-500/30'}
            `}>
              <Server className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1 ml-4">
              <h2 className="font-bold text-lg text-slate-800">
                {detail?.device_name || activeDevice.id}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {activeDevice.risk_level && (
                  <span className={`
                    px-2 py-0.5 text-xs rounded-full font-semibold
                    ${activeDevice.risk_level === 'very-high' ? 'bg-red-100 text-red-600' :
                      activeDevice.risk_level === 'high' ? 'bg-orange-100 text-orange-600' :
                      activeDevice.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-green-100 text-green-600'}
                  `}>
                    {activeDevice.risk_level === 'very-high' ? '极高风险' :
                     activeDevice.risk_level === 'high' ? '高风险' :
                     activeDevice.risk_level === 'medium' ? '中等风险' : '低风险'}
                  </span>
                )}
                {detail?.device_status && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    {detail.device_status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
              <Loader2 className="relative w-10 h-10 animate-spin text-blue-500" />
            </div>
          </div>
        ) : detail ? (
          <>
            {/* Location Info */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                位置信息
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <InfoCard icon={<Globe className="w-4 h-4" />} label="国家" value={detail.country || '-'} />
                <InfoCard icon={<MapPin className="w-4 h-4" />} label="省份" value={detail.province || '-'} />
                <InfoCard icon={<MapPin className="w-4 h-4" />} label="城市" value={detail.city || '-'} />
              </div>
            </div>

            {/* Device Basic Info */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                <Box className="w-3.5 h-3.5" />
                设备信息
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon={<Box className="w-4 h-4" />} label="设备类型" value={detail.device_type || '-'} />
                <InfoCard icon={<Box className="w-4 h-4" />} label="设备分类" value={detail.sample_type_cn || '-'} />
                <InfoCard icon={<Box className="w-4 h-4" />} label="外部型号" value={detail.device_extnal_modname || '-'} />
                <InfoCard icon={<Box className="w-4 h-4" />} label="产品名称" value={detail.device_prod_sprdname || '-'} />
              </div>
            </div>

            {/* Network & Version Info */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                <Network className="w-3.5 h-3.5" />
                网络与版本
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon={<Globe className="w-4 h-4" />} label="IP地址" value={detail.ip || detail.device_ip || '-'} />
                <InfoCard icon={<Box className="w-4 h-4" />} label="框架类型" value={detail.frame_type || '-'} />
                <InfoCard icon={<Box className="w-4 h-4" />} label="版本分类" value={detail.version_category || '-'} />
                <InfoCard icon={<Box className="w-4 h-4" />} label="BL版本" value={detail.bl_version || '-'} />
              </div>
            </div>

            {/* Status Info */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                状态信息
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <InfoCard icon={<Box className="w-4 h-4" />} label="30日活跃" value={detail.day30_active_flg === '1' ? '是' : '否'} />
                <InfoCard icon={<Box className="w-4 h-4" />} label="OOBE次数" value={detail.oobe_times || '0'} />
                <InfoCard icon={<Shield className="w-4 h-4" />} label="开发者模式" value={detail.developer_mode_status || '-'} />
              </div>
            </div>

            {/* Security ID */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                安全信息
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon={<Shield className="w-4 h-4" />} label="安全ID" value={detail.security_id || '-'} />
                <InfoCard icon={<Box className="w-4 h-4" />} label="分区日期" value={detail.pt_d || '-'} />
              </div>
            </div>

            {/* WiFi networks */}
            {detail.wifi_detection_list && detail.wifi_detection_list.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                  <Wifi className="w-3.5 h-3.5" />
                  WiFi检测 ({detail.wifi_detection_list.length})
                </h3>
                <div className="space-y-2">
                  {detail.wifi_detection_list.map((wifi: any, index: number) => {
                    const wifiText = `SSID: ${wifi.ssid || '-'}\nBSSID: ${wifi.bssid || '-'}\nAP IP: ${wifi.apexit_ip || '-'}\n时间: ${wifi.happentime || '-'}`
                    return (
                      <div key={index} className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/50 to-purple-500/50 rounded-xl blur opacity-0 group-hover:opacity-30 transition duration-300" />
                        <div className="relative p-4 bg-white rounded-xl border border-slate-200 shadow-sm group-hover:shadow-md transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                                <Wifi className="w-4 h-4 text-blue-500" />
                              </div>
                              <span className="font-semibold text-slate-700">{wifi.ssid || '-'}</span>
                            </div>
                            <button
                              onClick={() => navigator.clipboard.writeText(wifiText)}
                              className="p-1 hover:bg-slate-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="复制"
                            >
                              <Copy className="w-3 h-3 text-slate-400" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm text-slate-500">
                            <div><span className="text-slate-400">BSSID:</span> {wifi.bssid || '-'}</div>
                            <div><span className="text-slate-400">AP IP:</span> {wifi.apexit_ip || '-'}</div>
                            <div><span className="text-slate-400">时间:</span> {wifi.happentime || '-'}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* City Change List */}
            {detail.city_change_list && (
              <div className="space-y-3">
                <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  城市变化记录
                </h3>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">{detail.city_change_list}</pre>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <p>加载中...</p>
          </div>
        )}
      </div>

      {/* Footer action */}
      <div className="p-4 border-t border-slate-200/80 bg-gradient-to-t from-white to-slate-50">
        <button
          onClick={() => setShowDetailModal(true)}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-600 font-semibold rounded-xl border border-blue-200/50 hover:from-blue-500/20 hover:to-purple-500/20 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
        >
          <span>查看更多详情</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Detail Modal */}
      {showDetailModal && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDetailModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg max-h-[80vh] overflow-hidden bg-white rounded-2xl shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center shadow-lg
                  ${activeDevice?.risk_level === 'very-high' ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/30' :
                    activeDevice?.risk_level === 'high' ? 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-orange-500/30' :
                    activeDevice?.risk_level === 'medium' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-yellow-500/30' :
                    'bg-gradient-to-br from-blue-500 to-purple-600 shadow-blue-500/30'}
                `}>
                  <Server className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{detail.device_name || activeDevice?.id}</h3>
                  <p className="text-xs text-slate-500">设备详细信息</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh] p-6 space-y-6">
              {/* Location Info */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  位置信息
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <DetailItem label="国家" value={detail.country || '-'} />
                  <DetailItem label="省份" value={detail.province || '-'} />
                  <DetailItem label="城市" value={detail.city || '-'} />
                </div>
              </div>

              {/* Device Basic Info */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  设备信息
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <DetailItem label="设备ID" value={detail.id} />
                  <DetailItem label="设备类型" value={detail.device_type || '-'} />
                  <DetailItem label="设备分类" value={detail.sample_type_cn || '-'} />
                  <DetailItem label="外部型号" value={detail.device_extnal_modname || '-'} />
                  <DetailItem label="产品名称" value={detail.device_prod_sprdname || '-'} />
                  <DetailItem label="框架类型" value={detail.frame_type || '-'} />
                </div>
              </div>

              {/* Network & Version Info */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                  <Network className="w-4 h-4" />
                  网络与版本
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <DetailItem label="IP地址" value={detail.ip || detail.device_ip || '-'} />
                  <DetailItem label="版本分类" value={detail.version_category || '-'} />
                  <DetailItem label="BL版本" value={detail.bl_version || '-'} />
                  <DetailItem label="安全ID" value={detail.security_id || '-'} />
                </div>
              </div>

              {/* Status Info */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  状态信息
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <DetailItem label="30日活跃" value={detail.day30_active_flg === '1' ? '是' : '否'} />
                  <DetailItem label="OOBE次数" value={detail.oobe_times || '0'} />
                  <DetailItem label="开发者模式" value={detail.developer_mode_status || '-'} />
                  <DetailItem label="分区日期" value={detail.pt_d || '-'} />
                </div>
              </div>

              {/* WiFi Info */}
              {detail.wifi_detection_list && detail.wifi_detection_list.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                    <Wifi className="w-4 h-4" />
                    WiFi检测 ({detail.wifi_detection_list.length})
                  </h4>
                  <div className="space-y-2">
                    {detail.wifi_detection_list.map((wifi: any, index: number) => {
                      const wifiText = `SSID: ${wifi.ssid || '-'}\nBSSID: ${wifi.bssid || '-'}\nAP IP: ${wifi.apexit_ip || '-'}\n时间: ${wifi.happentime || '-'}`
                      return (
                        <div key={index} className="p-3 bg-slate-50 rounded-xl border border-slate-200 relative group">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-700">{wifi.ssid || '-'}</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(wifiText)}
                              className="p-1 hover:bg-slate-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="复制"
                            >
                              <Copy className="w-3 h-3 text-slate-400" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm text-slate-500">
                            <div>BSSID: {wifi.bssid || '-'}</div>
                            <div>AP IP: {wifi.apexit_ip || '-'}</div>
                            <div>时间: {wifi.happentime || '-'}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* City Change List */}
              {detail.city_change_list && (
                <div className="space-y-3">
                  <h4 className="text-xs uppercase text-slate-400 font-bold tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    城市变化记录
                    <button
                      onClick={() => navigator.clipboard.writeText(detail.city_change_list || '')}
                      className="ml-auto p-1 hover:bg-slate-200 rounded transition-colors"
                      title="复制"
                    >
                      <Copy className="w-3 h-3 text-slate-400" />
                    </button>
                  </h4>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">{detail.city_change_list}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-gradient-to-t from-slate-50 to-white">
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// DetailItem with copy button for modal
function DetailItem({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 relative group">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-700 font-mono pr-6 truncate">{value}</p>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 hover:bg-slate-200 rounded transition-colors opacity-0 group-hover:opacity-100"
        title="复制"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 text-slate-400" />
        )}
      </button>
    </div>
  )
}

// CopyButton component
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-slate-100 rounded transition-colors opacity-0 group-hover:opacity-100"
      title="复制"
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <Copy className="w-3 h-3 text-slate-400" />
      )}
    </button>
  )
}

// InfoCard with tooltip and copy
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const valueRef = useRef<HTMLParagraphElement>(null)

  return (
    <div className="relative group">
      {/* 3D shadow on hover */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-slate-300/50 to-slate-400/50 rounded-xl blur opacity-0 group-hover:opacity-30 transition duration-300" />

      <div className="relative p-3 bg-white rounded-xl border border-slate-200 shadow-sm group-hover:shadow-md transition-all">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-slate-500 flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 truncate">{label}</p>
            <div className="flex items-center gap-1">
              <p
                ref={valueRef}
                className="text-sm font-semibold text-slate-700 truncate flex-1"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                {value}
              </p>
              <CopyButton text={value} />
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-full ml-2 top-0 z-50 px-2 py-1 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap max-w-xs truncate">
            {value}
          </div>
        )}
      </div>
    </div>
  )
}
