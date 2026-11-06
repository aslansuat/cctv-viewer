import { useState, useEffect, useRef, useMemo, useCallback, type ChangeEvent, type MouseEvent, type DragEvent } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, FastForward, Rewind,
  Video, Eye, Shield, Users, Clock, AlertTriangle, CheckCircle,
  XCircle, Upload, RefreshCw, Sliders, Check, Copy,
  Volume2, VolumeX, Terminal, Activity, Trash2, Plus,
  FileDown, FileText, Keyboard, Edit3, X,
  ZoomIn, ZoomOut, RotateCcw, Sun, HardDrive,
  StepForward, StepBack, Bookmark, Link2, ArrowUpDown, Calendar,
  Camera, GripVertical, Printer
} from 'lucide-react';

export interface Interaction {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  participants: number;
  minDistance: string;
  confidence: number;
  status: 'verified' | 'pending' | 'dismissed';
  note: string;
  thumbnailLabel: string;
  snapshot?: string; // Base64 JPEG thumbnail
}

export interface CameraItem {
  id: string;
  name: string;
  location: string;
  duration: number;
  startDate?: string; // "YYYY-MM-DD" örn: "2026-08-13"
  startTime: string;   // "HH:mm:ss" örn: "08:00:00"
  status: 'completed' | 'scanning' | 'pending';
  fps: number;
  size: string;
  resolution: string;
  detectedCount: number;
  interactions: Interaction[];
  fileObject?: File;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return [
    hrs.toString().padStart(2, '0'),
    mins.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}

function formatShortDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs} sa ${mins} dk`;
  if (mins === 0) return `${secs} sn`;
  return `${mins} dk ${secs > 0 ? secs + ' sn' : ''}`;
}

export interface FilenameTimeInfo {
  startDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm:ss"
  endDate?: string;   // "YYYY-MM-DD"
  endTime?: string;   // "HH:mm:ss"
}

// Dosya adından başlangıç ve bitiş tarihi/saatini ayıklar
// Örnek: Honeywell_20260813080000_20260814065200_1.mp4
function extractDateTimeFromFilename(fileName: string): FilenameTimeInfo | null {
  // 1. İki adet 14 haneli zaman damgası (Başlangıç ve Bitiş): YYYYMMDDHHMMSS ... YYYYMMDDHHMMSS
  const double14 = fileName.match(/(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])([0-5]\d)([0-5]\d)[-_]+(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])([0-5]\d)([0-5]\d)/);
  if (double14) {
    const [, sY, sM, sD, sh, sm, ss, eY, eM, eD, eh, em, es] = double14;
    return {
      startDate: `${sY}-${sM}-${sD}`,
      startTime: `${sh}:${sm}:${ss}`,
      endDate: `${eY}-${eM}-${eD}`,
      endTime: `${eh}:${em}:${es}`
    };
  }

  // 2. Tekil 14 haneli zaman damgası: YYYYMMDDHHMMSS
  const single14 = fileName.match(/(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])([0-5]\d)([0-5]\d)/);
  if (single14) {
    const [, y, m, d, h, min, s] = single14;
    return {
      startDate: `${y}-${m}-${d}`,
      startTime: `${h}:${min}:${s}`
    };
  }

  // 3. Formatlı tarih-saat: YYYY-MM-DD_HH-MM-SS veya YYYY-MM-DD HH:MM:SS
  const matchIso = fileName.match(/(20\d{2})[-_/](0[1-9]|1[0-2])[-_/](0[1-9]|[12]\d|3[01])[-_\sT]+([01]\d|2[0-3])[-_:.]?([0-5]\d)[-_:.]?([0-5]\d)/i);
  if (matchIso) {
    const [, y, m, d, h, min, s] = matchIso;
    return {
      startDate: `${y}-${m}-${d}`,
      startTime: `${h}:${min}:${s}`
    };
  }

  // 4. Sadece saat: HH-MM-SS
  const matchTime = fileName.match(/(?:^|[^0-9])([01]\d|2[0-3])[-_:]([0-5]\d)[-_:]([0-5]\d)(?:[^0-9]|$)/);
  if (matchTime) {
    const [, h, min, s] = matchTime;
    return {
      startDate: new Date().toISOString().slice(0, 10),
      startTime: `${h}:${min}:${s}`
    };
  }

  return null;
}

// Tarih ve saat stringlerini yerel Date nesnesine dönüştürür
function parseDateTime(dateStr?: string, timeStr?: string): Date {
  const now = new Date();
  const dParts = dateStr ? dateStr.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  const tParts = (timeStr || '08:00:00').split(':').map(Number);

  const y = dParts[0] || now.getFullYear();
  const m = (dParts[1] || 1) - 1;
  const d = dParts[2] || 1;
  const h = tParts[0] || 0;
  const min = tParts[1] || 0;
  const s = tParts[2] || 0;

  return new Date(y, m, d, h, min, s, 0);
}

function formatDateToYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateToHMS(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Ekranda gösterim: "DD.MM.YYYY HH:mm:ss" veya "HH:mm:ss"
function formatDisplayDateTime(date: Date, includeDate = true): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const time = formatDateToHMS(date);
  return includeDate ? `${d}.${m}.${y} ${time}` : time;
}

// Tarihe saniye ekler (gece yarısı aşımında günü ve ayı otomatik takvim kurallarına göre ilerletir)
function addSecondsToDateTime(dateStr?: string, timeStr?: string, addedSeconds = 0): {
  date: Date;
  dateStr: string;
  timeStr: string;
  display: string;
} {
  const dt = parseDateTime(dateStr, timeStr);
  const result = new Date(dt.getTime() + Math.floor(addedSeconds) * 1000);
  return {
    date: result,
    dateStr: formatDateToYMD(result),
    timeStr: formatDateToHMS(result),
    display: formatDisplayDateTime(result, Boolean(dateStr))
  };
}

function formatClockTime(videoSeconds: number, baseOffsetStr: string, baseDateStr?: string, showFullDate = false): string {
  const res = addSecondsToDateTime(baseDateStr, baseOffsetStr, videoSeconds);
  return showFullDate && baseDateStr ? res.display : res.timeStr;
}

// Arka planda video dosyasının süre ve çözünürlüğünü hızlıca okur
function probeVideoMetadata(file: File): Promise<{ duration: number; resolution: string }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      const dur = Math.round(video.duration || 0);
      const res = video.videoWidth && video.videoHeight ? `${video.videoWidth}x${video.videoHeight}` : '1080p';
      URL.revokeObjectURL(url);
      resolve({ duration: dur, resolution: res });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: 0, resolution: '1080p' });
    };
  });
}

export default function App() {
  // 1. AUTO-SAVE / PERSISTENCE STATE RESTORATION
  const [cameras, setCameras] = useState<CameraItem[]>(() => {
    try {
      const saved = localStorage.getItem('cctv_viewer_cameras_v2');
      if (!saved) return [];
      const defaultStart = localStorage.getItem('cctv_camera_start_time') || '08:00:00';
      const parsed = JSON.parse(saved);
      return parsed.map((c: any) => ({
        ...c,
        startTime: c.startTime || defaultStart
      }));
    } catch {
      return [];
    }
  });

  const [activeCamId, setActiveCamId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('cctv_active_cam_id_v2') || null;
    } catch {
      return null;
    }
  });

  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);

  // Video playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  // 2. FORENSIC VIDEO ENHANCEMENT (ZOOM & PAN + LIGHT / CONTRAST)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingPan, setIsDraggingPan] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [showEnhanceMenu, setShowEnhanceMenu] = useState<boolean>(false);

  // 3. IN / OUT POINTS FOR PRECISE MANUAL INTERVAL MARKING
  const [markInTime, setMarkInTime] = useState<number | null>(null);

  // 4. TIME OFFSET / CAMERA REAL CLOCK SYNC
  const [cameraStartTime, setCameraStartTime] = useState<string>(() => {
    try {
      return localStorage.getItem('cctv_camera_start_time') || '08:00:00';
    } catch {
      return '08:00:00';
    }
  });
  const [showClockTime, setShowClockTime] = useState<boolean>(true);

  // Time editing modal state (per-camera)
  const [timeEditModalCamId, setTimeEditModalCamId] = useState<string | null>(null);
  const [timeEditDate, setTimeEditDate] = useState<string>('');
  const [timeEditValue, setTimeEditValue] = useState<string>('08:00:00');
  const [timeEditChainSubsequent, setTimeEditChainSubsequent] = useState<boolean>(true);

  const openTimeEditModal = useCallback((cam: CameraItem) => {
    setTimeEditModalCamId(cam.id);
    setTimeEditDate(cam.startDate || new Date().toISOString().slice(0, 10));
    setTimeEditValue(cam.startTime || '08:00:00');
    setTimeEditChainSubsequent(true);
  }, []);

  // Drag and Drop state for reordering cameras in the left queue
  const [draggedCamIdx, setDraggedCamIdx] = useState<number | null>(null);
  const [dragOverCamIdx, setDragOverCamIdx] = useState<number | null>(null);

  // Scanner parameter filters (Adjusted for high-accuracy corridor detection)
  const [samplingRate, setSamplingRate] = useState<number>(1.0); // 1.0 saniye
  const [minDistanceThreshold, setMinDistanceThreshold] = useState<number>(120);
  const [minDwellTime, setMinDwellTime] = useState<number>(3); // 3 saniye geçişler
  const [motionSensitivity, setMotionSensitivity] = useState<'high' | 'normal' | 'low'>('high');
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const abortScanRef = useRef<boolean>(false);

  // Modals & View States
  const [selectedInteractionId, setSelectedInteractionId] = useState<string | null>(null);
  const [showFfmpegModal, setShowFfmpegModal] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [reportOnlyVerified, setReportOnlyVerified] = useState<boolean>(false);

  // Batch import text state
  const [importText, setImportText] = useState<string>(
    `34:20  ... geldi
...`
  );

  // Inline note editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string>('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Video and events list refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const eventsListRef = useRef<HTMLDivElement | null>(null);

  // Active camera object
  const activeCamera = useMemo(() => {
    return cameras.find(c => c.id === activeCamId) || cameras[0] || null;
  }, [cameras, activeCamId]);

  // Toast notifier helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // 1. AUTO-SAVE HOOK: Persist cameras & interactions to localStorage
  useEffect(() => {
    try {
      // Exclude binary fileObject from JSON serialization
      const storable = cameras.map(({ fileObject, ...rest }) => rest);
      localStorage.setItem('cctv_viewer_cameras_v2', JSON.stringify(storable));
    } catch (e) {
      console.warn('Auto-save to localStorage failed', e);
    }
  }, [cameras]);

  useEffect(() => {
    if (activeCamId) {
      localStorage.setItem('cctv_active_cam_id_v2', activeCamId);
    }
  }, [activeCamId]);

  useEffect(() => {
    localStorage.setItem('cctv_camera_start_time', cameraStartTime);
  }, [cameraStartTime]);

  // Sync playbackRate to HTMLVideoElement (cap at 8x; 16x+ uses smart scrubbing)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = Math.min(8, playbackRate);
    }
  }, [playbackRate]);

  // Smart high-speed scrubbing ticker for 16x, 32x and 64x without decoder blanking
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isPlaying && playbackRate >= 16 && videoRef.current) {
      // Native playback capped at 8x; interval compensates the rest.
      // Effective extra advance per 100ms tick:
      //   16x → (16-8)*0.1 = 0.8s   32x → (32-8)*0.1 = 2.4s   64x → (64-8)*0.1 = 5.6s
      const extraAdvance = (playbackRate - 8) * 0.1;
      interval = setInterval(() => {
        if (videoRef.current && activeCamera) {
          const nextTime = videoRef.current.currentTime + extraAdvance;
          if (nextTime >= activeCamera.duration) {
            setIsPlaying(false);
            videoRef.current.pause();
          } else {
            videoRef.current.currentTime = nextTime;
            setCurrentTime(nextTime);
          }
        }
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackRate, activeCamera]);

  // Auto-dismiss: mark 'pending' events as 'dismissed' (false alarm) when
  // the video playhead passes their endTime during normal playback.
  // Disabled while scanning (scanner seeks through the video and would dismiss everything).
  useEffect(() => {
    if (!isPlaying || isScanningActive || !activeCamera) return;
    const currentCamId = activeCamera.id;
    const pendingPassed = activeCamera.interactions.filter(
      (item) => item.status === 'pending' && currentTime >= item.endTime
    );
    if (pendingPassed.length === 0) return;

    const idsToAutoDismiss = new Set(pendingPassed.map((i) => i.id));
    setCameras((prev) =>
      prev.map((cam) => {
        if (cam.id !== currentCamId) return cam;
        return {
          ...cam,
          interactions: cam.interactions.map((item) => {
            if (idsToAutoDismiss.has(item.id) && item.status === 'pending') {
              return { ...item, status: 'dismissed' as const };
            }
            return item;
          }),
        };
      })
    );
  }, [currentTime, isPlaying, isScanningActive, activeCamera]);

  // Find currently active or next upcoming pending interaction to center in right panel
  const currentPendingItem = useMemo(() => {
    if (!activeCamera) return null;
    return activeCamera.interactions.find(
      (item) => item.status === 'pending' && currentTime < item.endTime
    ) || null;
  }, [activeCamera, currentTime]);

  const currentPendingId = currentPendingItem?.id || null;

  // Auto-scroll the right list to keep the active / next pending event centered as events are dismissed
  useEffect(() => {
    if (editingId || !currentPendingId || !eventsListRef.current) return;
    const container = eventsListRef.current;
    const targetEl = container.querySelector<HTMLElement>(`[data-interaction-id="${currentPendingId}"]`);
    if (!targetEl) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const currentCenter = targetRect.top - containerRect.top + (targetRect.height / 2);
    const desiredCenter = container.clientHeight / 2;
    const diff = currentCenter - desiredCenter;

    if (Math.abs(diff) > 25) {
      container.scrollBy({ top: diff, behavior: 'smooth' });
    }
  }, [currentPendingId, editingId]);

  // Auto-scroll to selected interaction when explicitly chosen
  useEffect(() => {
    if (!selectedInteractionId || !eventsListRef.current) return;
    const container = eventsListRef.current;
    const targetEl = container.querySelector<HTMLElement>(`[data-interaction-id="${selectedInteractionId}"]`);
    if (!targetEl) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const currentCenter = targetRect.top - containerRect.top + (targetRect.height / 2);
    const desiredCenter = container.clientHeight / 2;
    const diff = currentCenter - desiredCenter;

    if (Math.abs(diff) > 25) {
      container.scrollBy({ top: diff, behavior: 'smooth' });
    }
  }, [selectedInteractionId]);

  // Natural sorting for camera list (Part 1, Part 1-1, Part 1-2 etc.)
  const sortCamerasNaturally = useCallback(() => {
    setCameras(prev => {
      const sorted = [...prev].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      return sorted;
    });
    showToast('Videolar dosya adına göre doğal sıralandı.');
  }, [showToast]);

  // Sequential start date & time auto-chaining for multi-part video exports
  const autoChainCameraTimes = useCallback((startFromIdx: number = 0, initialStartDate?: string, initialStartTime?: string) => {
    setCameras(prev => {
      if (prev.length <= 1) {
        showToast('Zincirleme için listede en az 2 video bulunmalıdır.');
        return prev;
      }
      const firstCam = prev[startFromIdx] || prev[0];
      let runningDate = initialStartDate || firstCam.startDate || new Date().toISOString().slice(0, 10);
      let runningTime = initialStartTime || firstCam.startTime || cameraStartTime || '08:00:00';
      const updated = [...prev];

      for (let i = startFromIdx; i < updated.length; i++) {
        const cam = updated[i];
        if (i === startFromIdx && !initialStartTime) {
          runningDate = cam.startDate || runningDate;
          runningTime = cam.startTime || runningTime;
          if (cam.duration > 0) {
            const nextEnd = addSecondsToDateTime(runningDate, runningTime, cam.duration);
            runningDate = nextEnd.dateStr;
            runningTime = nextEnd.timeStr;
          }
        } else {
          updated[i] = {
            ...cam,
            startDate: runningDate,
            startTime: runningTime
          };
          if (cam.duration > 0) {
            const nextEnd = addSecondsToDateTime(runningDate, runningTime, cam.duration);
            runningDate = nextEnd.dateStr;
            runningTime = nextEnd.timeStr;
          }
        }
      }
      showToast(`${updated.length} parçalı videonun tarih ve başlangıç saatleri ardışık olarak zincirlendi!`);
      return updated;
    });
  }, [cameraStartTime, showToast]);

  // Helper to reorder cameras via drag-and-drop and auto-chain sequential times
  const handleReorderCameras = useCallback((sourceIdx: number, targetIdx: number) => {
    if (sourceIdx === targetIdx) return;
    setCameras(prev => {
      const next = [...prev];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIdx, 0, moved);

      // Re-chain start dates & times according to the new sequence
      if (next.length > 1) {
        const first = next[0];
        let runningDate = first.startDate || new Date().toISOString().slice(0, 10);
        let runningTime = first.startTime || cameraStartTime || '08:00:00';
        return next.map((cam, idx) => {
          if (idx === 0) {
            if (cam.duration > 0) {
              const nextEnd = addSecondsToDateTime(runningDate, runningTime, cam.duration);
              runningDate = nextEnd.dateStr;
              runningTime = nextEnd.timeStr;
            }
            return cam;
          }
          const updated = {
            ...cam,
            startDate: runningDate,
            startTime: runningTime
          };
          if (cam.duration > 0) {
            const nextEnd = addSecondsToDateTime(runningDate, runningTime, cam.duration);
            runningDate = nextEnd.dateStr;
            runningTime = nextEnd.timeStr;
          }
          return updated;
        });
      }
      return next;
    });
    showToast('Video sırası güncellendi ve zamanlar yeni sıraya göre zincirlendi.');
  }, [cameraStartTime, showToast]);

  // Save edited start date & time for a specific camera
  const handleSaveEditedStartTime = useCallback((camId: string, newDate: string, newTime: string, chainSubsequent: boolean) => {
    const trimmed = newTime.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(trimmed)) {
      showToast('Geçersiz saat formatı! Lütfen SS:DD:SS (örn: 08:30:00) şeklinde giriniz.');
      return;
    }
    const formattedTime = trimmed.split(':').length === 2 ? `${trimmed}:00` : trimmed;
    const formattedDate = newDate || new Date().toISOString().slice(0, 10);

    setCameras(prev => {
      const idx = prev.findIndex(c => c.id === camId);
      if (idx === -1) return prev;

      const updated = [...prev];
      updated[idx] = { ...updated[idx], startDate: formattedDate, startTime: formattedTime };

      if (chainSubsequent && idx < updated.length - 1) {
        let runningEnd = addSecondsToDateTime(formattedDate, formattedTime, updated[idx].duration || 0);
        for (let i = idx + 1; i < updated.length; i++) {
          updated[i] = { ...updated[i], startDate: runningEnd.dateStr, startTime: runningEnd.timeStr };
          if (updated[i].duration > 0) {
            runningEnd = addSecondsToDateTime(runningEnd.dateStr, runningEnd.timeStr, updated[i].duration);
          }
        }
      }

      return updated;
    });

    setTimeEditModalCamId(null);
    showToast(`Videonun başlangıç zamanı kaydedildi: ${formatDisplayDateTime(parseDateTime(formattedDate, formattedTime))}`);
  }, [showToast]);

  // Add files to queue helper with automatic date/time detection & chunk chaining
  const addFilesToQueue = useCallback((files: File[]) => {
    if (!files.length) return;

    // 1. Natural alphanumeric sort so chunks (_1, _1-1, _1-2) are chronological
    const sortedFiles = [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    const firstExtracted = extractDateTimeFromFilename(sortedFiles[0].name);
    const defaultDate = firstExtracted?.startDate || new Date().toISOString().slice(0, 10);
    const defaultTime = firstExtracted?.startTime || cameraStartTime || '08:00:00';

    const newCams: CameraItem[] = sortedFiles.map((file, idx) => {
      const fileExtracted = extractDateTimeFromFilename(file.name);
      return {
        id: `local-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        location: 'Yerel Dosya',
        duration: 0,
        startDate: fileExtracted?.startDate || defaultDate,
        startTime: fileExtracted?.startTime || defaultTime,
        status: 'pending' as const,
        fps: 25,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        resolution: 'Yükleniyor...',
        detectedCount: 0,
        interactions: [],
        fileObject: file
      };
    });

    setCameras(prev => [...prev, ...newCams]);

    if (!activeCamId || cameras.length === 0) {
      const firstCam = newCams[0];
      setActiveCamId(firstCam.id);
      if (firstCam.fileObject) {
        const url = URL.createObjectURL(firstCam.fileObject);
        setLocalVideoUrl(url);
        setCurrentTime(0);
      }
    }

    showToast(`${files.length} video kuyruğa eklendi. Süreler ve tarihler taranıyor...`);

    // Asynchronously probe durations & resolutions in background
    Promise.all(
      newCams.map(async (cam) => {
        if (!cam.fileObject) return { id: cam.id, duration: 0, resolution: '1080p' };
        const meta = await probeVideoMetadata(cam.fileObject);
        return { id: cam.id, duration: meta.duration, resolution: meta.resolution };
      })
    ).then((metaResults) => {
      setCameras(prev => {
        const metaMap = new Map(metaResults.map(m => [m.id, m]));
        let updated = prev.map(c => {
          const m = metaMap.get(c.id);
          if (m) {
            return {
              ...c,
              duration: m.duration || c.duration,
              resolution: m.resolution || c.resolution
            };
          }
          return c;
        });

        // Check if this batch is a chunked sequence (e.g. _1, _1-1, _1-2 or Honeywell export)
        const isChunkedBatch = sortedFiles.length > 1 && sortedFiles.some(f =>
          /[-_]\d+[-_]\d+\.mp4$/i.test(f.name) || /[-_]\d+\.mp4$/i.test(f.name) || /part\d+/i.test(f.name)
        );

        if (isChunkedBatch) {
          let runningDate = newCams[0].startDate || defaultDate;
          let runningTime = newCams[0].startTime || defaultTime;
          const newIds = new Set(newCams.map(c => c.id));
          updated = updated.map(c => {
            if (newIds.has(c.id)) {
              const curDate = runningDate;
              const curTime = runningTime;
              if (c.duration > 0) {
                const nextEnd = addSecondsToDateTime(curDate, curTime, c.duration);
                runningDate = nextEnd.dateStr;
                runningTime = nextEnd.timeStr;
              }
              return {
                ...c,
                startDate: curDate,
                startTime: curTime
              };
            }
            return c;
          });
        }

        return updated;
      });
    });
  }, [activeCamId, cameras.length, cameraStartTime, showToast]);

  // Re-link existing camera video file (after F5 page reload)
  const handleRelinkFile = (camId: string, file: File) => {
    setCameras(prev => prev.map(c => c.id === camId ? { ...c, fileObject: file } : c));
    if (localVideoUrl) {
      URL.revokeObjectURL(localVideoUrl);
    }
    const url = URL.createObjectURL(file);
    setLocalVideoUrl(url);
    showToast(`"${file.name}" dosyası başarıyla bağlandı. Olaylar korundu!`);
  };

  // Handle local video upload input
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    addFilesToQueue(files);
  };

  // Drag and drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('video/') || /\.(mp4|webm|mkv|avi|mov)$/i.test(f.name)
    );
    if (files.length > 0) {
      addFilesToQueue(files);
    }
  };

  // Camera selection from playlist
  const handleSelectCamera = (cam: CameraItem) => {
    if (cam.id === activeCamId) return;
    setActiveCamId(cam.id);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedInteractionId(null);
    setMarkInTime(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    if (cam.fileObject) {
      if (localVideoUrl) {
        URL.revokeObjectURL(localVideoUrl);
      }
      const url = URL.createObjectURL(cam.fileObject);
      setLocalVideoUrl(url);
    } else {
      setLocalVideoUrl(null);
    }
  };

  // Remove camera from queue
  const handleRemoveCamera = (camId: string, e: MouseEvent) => {
    e.stopPropagation();
    setCameras(prev => {
      const updated = prev.filter(c => c.id !== camId);
      if (activeCamId === camId) {
        if (updated.length > 0) {
          const next = updated[0];
          setActiveCamId(next.id);
          if (next.fileObject) {
            setLocalVideoUrl(URL.createObjectURL(next.fileObject));
          } else {
            setLocalVideoUrl(null);
          }
        } else {
          setActiveCamId(null);
          setLocalVideoUrl(null);
          setIsPlaying(false);
        }
      }
      return updated;
    });
    showToast('Video kuyruktan kaldırıldı.');
  };

  // Zoom & Pan Wheel handler
  const handleVideoWheel = (e: React.WheelEvent) => {
    if (!activeCamera || !localVideoUrl) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoom(prev => {
      const next = Math.max(1, Math.min(4, Math.round((prev + delta) * 100) / 100));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMouseDownPan = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDraggingPan(true);
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (isDraggingPan && zoom > 1) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUpPan = () => {
    setIsDraggingPan(false);
  };

  // Precise Frame-by-Frame step (1 Frame = 0.04s for 25 FPS)
  const stepFrame = useCallback((forward: boolean) => {
    if (!videoRef.current || !activeCamera) return;
    const fps = activeCamera.fps || 25;
    const frameDuration = 1 / fps;
    const target = forward
      ? Math.min(activeCamera.duration, videoRef.current.currentTime + frameDuration)
      : Math.max(0, videoRef.current.currentTime - frameDuration);

    videoRef.current.currentTime = target;
    setCurrentTime(target);
    if (isPlaying) {
      setIsPlaying(false);
      videoRef.current.pause();
    }
    showToast(forward ? `+1 Kare (0.04 sn)` : `-1 Kare (0.04 sn)`);
  }, [activeCamera, isPlaying, showToast]);

  // Set Mark In [ point
  const handleSetMarkIn = useCallback(() => {
    const t = Math.floor(currentTime);
    setMarkInTime(t);
    showToast(`Giriş [IN] belirlendi: ${formatTime(t)} | Bitiş için ']' tuşuna basın.`);
  }, [currentTime, showToast]);

  // Set Mark Out ] point and add interaction
  const handleSetMarkOut = useCallback(() => {
    if (markInTime === null) {
      showToast("Önce '[' tuşuyla başlangıç noktasını belirleyin.");
      return;
    }
    const inT = markInTime;
    const outT = Math.floor(currentTime);
    const start = Math.min(inT, outT);
    const end = Math.max(inT, outT);
    const duration = Math.max(1, end - start);

    const newInt: Interaction = {
      id: `int-${Date.now()}`,
      startTime: start,
      endTime: end,
      duration,
      participants: 2,
      minDistance: '1.0m',
      confidence: 100,
      status: 'verified',
      note: 'Manuel aralık (Giriş/Çıkış ile belirlendi)',
      thumbnailLabel: 'Aralık İşaret'
    };

    setCameras(prev => prev.map(c => {
      if (c.id === activeCamera?.id) {
        return {
          ...c,
          detectedCount: c.interactions.length + 1,
          interactions: [...c.interactions, newInt].sort((a, b) => a.startTime - b.startTime)
        };
      }
      return c;
    }));

    setSelectedInteractionId(newInt.id);
    setMarkInTime(null);
    showToast(`Aralık eklendi: ${formatTime(start)} - ${formatTime(end)} (${duration} sn)`);
  }, [markInTime, currentTime, activeCamera, showToast]);

  // Real client-side motion / activity scanner on the actual video
  const runRapidScanner = async () => {
    if (!activeCamera || !videoRef.current || isScanningActive) return;
    const video = videoRef.current;
    const duration = activeCamera.duration || video.duration;
    if (!duration || duration <= 0) {
      showToast('Video süresi henüz belirlenemedi. Lütfen videonun yüklenmesini bekleyin.');
      return;
    }

    setIsScanningActive(true);
    abortScanRef.current = false;
    setScanProgress(0);
    showToast(`"${activeCamera.name}" taranıyor... Hassasiyet: ${motionSensitivity.toUpperCase()}`);

    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = 160;
    scanCanvas.height = 90;
    const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      setIsScanningActive(false);
      return;
    }

    const colorDiffThreshold = motionSensitivity === 'high' ? 25 : motionSensitivity === 'normal' ? 38 : 55;
    const motionPercentThreshold = motionSensitivity === 'high' ? 1.0 : motionSensitivity === 'normal' ? 2.2 : 4.0;

    const step = Math.max(0.5, samplingRate);
    let prevImageData: Uint8ClampedArray | null = null;
    const activeSegments: { start: number; end: number; score: number }[] = [];
    let currentSegment: { start: number; end: number; score: number } | null = null;

    const originalTime = video.currentTime;
    const originalMuted = video.muted;
    video.muted = true;

    try {
      for (let t = 0; t < duration; t += step) {
        if (abortScanRef.current) break;

        video.currentTime = t;
        await new Promise<void>((resolve) => {
          let resolved = false;
          const done = () => {
            if (!resolved) {
              resolved = true;
              video.removeEventListener('seeked', done);
              resolve();
            }
          };
          video.addEventListener('seeked', done, { once: true });
          setTimeout(done, 140);
        });

        ctx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
        const imgData = ctx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
        const data = imgData.data;

        if (prevImageData) {
          let diffCount = 0;
          const totalSamples = data.length / 16;
          for (let i = 0; i < data.length; i += 16) {
            const rDiff = Math.abs(data[i] - prevImageData[i]);
            const gDiff = Math.abs(data[i + 1] - prevImageData[i + 1]);
            const bDiff = Math.abs(data[i + 2] - prevImageData[i + 2]);
            if (rDiff + gDiff + bDiff > colorDiffThreshold) {
              diffCount++;
            }
          }
          const motionPct = (diffCount / totalSamples) * 100;

          if (motionPct > motionPercentThreshold) {
            if (!currentSegment) {
              currentSegment = { start: Math.max(0, t - step), end: t + step, score: Math.round(motionPct) };
            } else {
              currentSegment.end = t + step;
              currentSegment.score = Math.max(currentSegment.score, Math.round(motionPct));
            }
          } else {
            if (currentSegment) {
              if (currentSegment.end - currentSegment.start >= minDwellTime) {
                activeSegments.push({ ...currentSegment });
              }
              currentSegment = null;
            }
          }
        }

        prevImageData = new Uint8ClampedArray(data);
        const progress = Math.min(100, Math.round((t / duration) * 100));
        setScanProgress(progress);
      }

      if (currentSegment && currentSegment.end - currentSegment.start >= minDwellTime) {
        activeSegments.push(currentSegment);
      }

      const newInteractions: Interaction[] = activeSegments.map((seg, idx) => ({
        id: `int-${Date.now()}-${idx}`,
        startTime: Math.round(seg.start),
        endTime: Math.round(seg.end),
        duration: Math.max(1, Math.round(seg.end - seg.start)),
        participants: 2,
        minDistance: '1.0m',
        confidence: Math.min(99, Math.max(70, seg.score * 5)),
        status: 'pending',
        note: `Hareket algılandı (${Math.round(seg.end - seg.start)} sn aktivite)`,
        thumbnailLabel: `Hareket #${idx + 1}`
      }));

      setCameras(prev => prev.map(c => {
        if (c.id === activeCamera.id) {
          return {
            ...c,
            status: 'completed',
            detectedCount: newInteractions.length,
            interactions: newInteractions
          };
        }
        return c;
      }));

      showToast(`Tarama bitti: ${newInteractions.length} hareketli aralık işaretlendi.`);
    } catch {
      showToast('Tarama sırasında bir hata oluştu.');
    } finally {
      video.currentTime = originalTime;
      video.muted = originalMuted;
      setIsScanningActive(false);
      setScanProgress(100);
    }
  };

  const cancelScanner = () => {
    abortScanRef.current = true;
    setIsScanningActive(false);
    showToast('Tarama kullanıcı tarafından durduruldu.');
  };

  // Grabs current video frame as lightweight 640x360 Base64 JPEG data URL (~25-35KB)
  const grabFrameSnapshot = useCallback((): string | undefined => {
    if (!videoRef.current) return undefined;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return undefined;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.75);
    } catch (e) {
      console.error('Frame snapshot error:', e);
      return undefined;
    }
  }, []);

  // Update snapshot for a specific interaction
  const updateInteractionSnapshot = useCallback((interactionId: string) => {
    const shot = grabFrameSnapshot();
    if (!shot) {
      showToast('Kare yakalanamadı. Lütfen videonun oynatılabilir olduğundan emin olun.');
      return;
    }
    const currentCamId = activeCamera?.id || activeCamId;
    setCameras(prev => prev.map(c => {
      if (c.id !== currentCamId) return c;
      return {
        ...c,
        interactions: c.interactions.map(item =>
          item.id === interactionId ? { ...item, snapshot: shot } : item
        )
      };
    }));
    showToast('Olay görseli o anki kare ile güncellendi!');
  }, [activeCamera?.id, activeCamId, grabFrameSnapshot, showToast]);

  // Add manual incident interval at current time
  const handleAddManualInteraction = useCallback(() => {
    if (!activeCamera) return;
    const start = Math.floor(currentTime);
    const end = Math.min(activeCamera.duration, start + 30);
    const shot = grabFrameSnapshot();
    const newInt: Interaction = {
      id: `int-${Date.now()}`,
      startTime: start,
      endTime: end,
      duration: Math.max(1, end - start),
      participants: 2,
      minDistance: '1.0m',
      confidence: 100,
      status: 'verified',
      note: 'Manuel işaretlenen şüpheli olay / görüşme',
      thumbnailLabel: 'Manuel İşaret',
      snapshot: shot
    };

    setCameras(prev => prev.map(c => {
      if (c.id === activeCamera.id) {
        return {
          ...c,
          detectedCount: c.interactions.length + 1,
          interactions: [...c.interactions, newInt].sort((a, b) => a.startTime - b.startTime)
        };
      }
      return c;
    }));
    setSelectedInteractionId(newInt.id);
    showToast(`Olay işaretlendi ve kare kaydedildi: ${formatTime(start)} - ${formatTime(end)}`);
  }, [activeCamera, currentTime, grabFrameSnapshot, showToast]);

  // Import batch incidents from text format
  const handleImportIncidents = () => {
    if (!activeCamera) return;
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    const newItems: Interaction[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*(.*)$/);
      if (!match) continue;

      const timeStr = match[1];
      const noteStr = match[2] || 'Tespit edilen olay';
      const parts = timeStr.split(':').map(Number);
      let seconds = 0;
      if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      }

      const pMatch = noteStr.match(/(\d+)\s*kişi/i);
      const participants = pMatch ? parseInt(pMatch[1]) : 2;

      const duration = 30; // 30s event window default
      newItems.push({
        id: `int-import-${Date.now()}-${idx}`,
        startTime: seconds,
        endTime: Math.min(activeCamera.duration || (seconds + duration), seconds + duration),
        duration: duration,
        participants,
        minDistance: '1.0m',
        confidence: 100,
        status: 'pending',
        note: noteStr,
        thumbnailLabel: `Olay #${idx + 1}`
      });
    }

    if (newItems.length > 0) {
      setCameras(prev => prev.map(c => {
        if (c.id === activeCamera.id) {
          const combined = [...c.interactions, ...newItems].sort((a, b) => a.startTime - b.startTime);
          return {
            ...c,
            detectedCount: combined.length,
            interactions: combined
          };
        }
        return c;
      }));
      showToast(`${newItems.length} olay listeye başarıyla eklendi!`);
      setShowImportModal(false);
    } else {
      showToast('Zaman formatı eşleşen satır bulunamadı (Örn: 34:20 veya 1:24:15).');
    }
  };

  // Delete interaction
  const handleDeleteInteraction = (interactionId: string) => {
    const currentCamId = activeCamera?.id || activeCamId;
    setCameras(prev => prev.map(c => {
      if (c.id !== currentCamId) return c;
      const filtered = c.interactions.filter(i => i.id !== interactionId);
      return {
        ...c,
        detectedCount: filtered.length,
        interactions: filtered
      };
    }));
    if (selectedInteractionId === interactionId) {
      setSelectedInteractionId(null);
    }
    showToast('Etkileşim kaydı silindi.');
  };

  // Save edited note
  const handleSaveNote = (interactionId: string) => {
    const currentCamId = activeCamera?.id || activeCamId;
    setCameras(prev => prev.map(c => {
      if (c.id !== currentCamId) return c;
      return {
        ...c,
        interactions: c.interactions.map(item => item.id === interactionId ? { ...item, note: editingNote } : item)
      };
    }));
    setEditingId(null);
    showToast('Not güncellendi.');
  };

  // Capture real frame snapshot from video
  const captureSnapshot = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.download = `${activeCamera?.name.replace(/\.[^/.]+$/, '') || 'cctv'}_kare_${Math.floor(currentTime)}s.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Kare görüntüsü yakalandı ve indirildi.');
    }
  }, [activeCamera, currentTime, showToast]);

  // Jump directly to incident timestamp with 3 seconds buffer before event
  const jumpToIncident = (interaction: Interaction) => {
    const target = Math.max(0, interaction.startTime - 3);
    setCurrentTime(target);
    setSelectedInteractionId(interaction.id);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
    showToast(`Zamana atlandı: ${formatTime(target)} (Olay anından 3 sn önce)`);
  };

  // Status updates for interactions (Verified / Dismissed / Pending toggle)
  const handleUpdateStatus = (interactionId: string, newStatus: 'verified' | 'dismissed') => {
    const currentCamId = activeCamera?.id || activeCamId;
    setCameras(prev => prev.map(cam => {
      if (cam.id !== currentCamId) return cam;
      return {
        ...cam,
        interactions: cam.interactions.map(item => {
          if (item.id === interactionId) {
            const nextStatus = item.status === newStatus ? 'pending' : newStatus;
            return { ...item, status: nextStatus };
          }
          return item;
        })
      };
    }));
    showToast(newStatus === 'verified' ? 'Etkileşim durumu güncellendi' : 'Yanlış alarm olarak işaretlendi');
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => {
          const next = !prev;
          if (videoRef.current) {
            if (next) videoRef.current.play();
            else videoRef.current.pause();
          }
          return next;
        });
      } else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        const speeds = [0.5, 1, 2, 4, 8, 16, 32, 64];
        setPlaybackRate(prev => {
          const idx = speeds.indexOf(prev);
          const next = idx < speeds.length - 1 ? speeds[idx + 1] : speeds[idx];
          showToast(`Hız: ${next}x`);
          return next;
        });
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        const speeds = [0.5, 1, 2, 4, 8, 16, 32, 64];
        setPlaybackRate(prev => {
          const idx = speeds.indexOf(prev);
          const next = idx > 0 ? speeds[idx - 1] : speeds[0];
          showToast(`Hız: ${next}x`);
          return next;
        });
      } else if (e.key === '0' || e.code === 'Numpad0') {
        e.preventDefault();
        setPlaybackRate(1);
        showToast('Hız: 1x (Normal)');
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 5;
        if (activeCamera && videoRef.current) {
          const target = Math.min(activeCamera.duration, videoRef.current.currentTime + step);
          setCurrentTime(target);
          videoRef.current.currentTime = target;
          showToast(`+${step} sn ileri`);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 5;
        if (videoRef.current) {
          const target = Math.max(0, videoRef.current.currentTime - step);
          setCurrentTime(target);
          videoRef.current.currentTime = target;
          showToast(`-${step} sn geri`);
        }
      } else if (e.key === '.' || e.key === '>') {
        e.preventDefault();
        stepFrame(true);
      } else if (e.key === ',' || e.key === '<') {
        e.preventDefault();
        stepFrame(false);
      } else if (e.key === '[') {
        e.preventDefault();
        handleSetMarkIn();
      } else if (e.key === ']') {
        e.preventDefault();
        handleSetMarkOut();
      } else if (e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'i') {
        e.preventDefault();
        handleAddManualInteraction();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        captureSnapshot();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCamera, handleAddManualInteraction, handleSetMarkIn, handleSetMarkOut, stepFrame, captureSnapshot, showToast]);

  // Generate Markdown Forensic Report (with Real Time + Video Time)
  const generateMarkdownReport = (onlyVerified = false): string => {
    if (!activeCamera) return '';
    const list = onlyVerified
      ? activeCamera.interactions.filter(i => i.status === 'verified')
      : activeCamera.interactions;

    const verifiedCount = activeCamera.interactions.filter(i => i.status === 'verified').length;
    const dismissedCount = activeCamera.interactions.filter(i => i.status === 'dismissed').length;
    const pendingCount = activeCamera.interactions.filter(i => i.status === 'pending').length;

    const dateStr = new Date().toLocaleString('tr-TR');
    const camStartTime = activeCamera.startTime || cameraStartTime || '08:00:00';
    const camStartFull = activeCamera.startDate
      ? `${activeCamera.startDate.split('-').reverse().join('.')} ${camStartTime}`
      : camStartTime;

    return `# 📋 CCTV GÖRÜNTÜ VE ETKİLEŞİM İNCELEME RAPORU

**Rapor Tarihi:** ${dateStr}  
**İncelenen Dosya:** \`${activeCamera.name}\`  
**Kamera Başlangıç Zamanı:** \`${camStartFull}\` (Kayıt Saati Senkronize)  
**Kayıt Süresi:** ${formatTime(activeCamera.duration)} (${(activeCamera.duration / 3600).toFixed(1)} Saat)  
**Dosya Boyutu / Çözünürlük:** ${activeCamera.size} • ${activeCamera.resolution}  

### 📊 İnceleme İstatistiği:
- **Toplam İşaretlenen Olay:** ${activeCamera.interactions.length}
- **✅ Doğrulanan Olaylar:** ${verifiedCount}
- **⏳ İncelenmeyi Bekleyen:** ${pendingCount}
- **❌ Elenen (Yanlış Alarm):** ${dismissedCount}
- **Raporlanan Olay Sayısı:** ${list.length}

---

## 📌 Kronolojik Olay Çizelgesi

| No | Video Süresi | Gerçek Tarih & Saat | Süre | Kişi | Durum | Tespit ve Not |
|---|---|---|---|---|---|---|
${list.map((item, idx) => {
      const statusEmoji = item.status === 'verified' ? '✅ Doğrulandı' : item.status === 'dismissed' ? '❌ Elendi' : '⏳ Bekliyor';
      const realTimeStr = `${formatClockTime(item.startTime, camStartTime, activeCamera.startDate, true)} - ${formatClockTime(item.endTime, camStartTime, activeCamera.startDate, false)}`;
      return `| ${String(idx + 1).padStart(2, '0')} | ${formatTime(item.startTime)} - ${formatTime(item.endTime)} | ${realTimeStr} | ${item.duration} sn | ${item.participants} | ${statusEmoji} | ${item.note.replace(/\|/g, '-')} |`;
    }).join('\n')}

---

## 📝 Detaylı Olay Açıklamaları

${list.map((item, idx) => `### 🔹 Olay #${String(idx + 1).padStart(2, '0')} — ${formatTime(item.startTime)} - ${formatTime(item.endTime)}
- **Video Zamanı:** \`${formatTime(item.startTime)}\` - \`${formatTime(item.endTime)}\` (${formatShortDuration(item.duration)})
- **Gerçek Zaman Damgası:** \`${formatClockTime(item.startTime, camStartTime, activeCamera.startDate, true)}\` - \`${formatClockTime(item.endTime, camStartTime, activeCamera.startDate, false)}\`
- **Tespit / Açıklama:** ${item.note}
- **Katılımcı / Kişi Sayısı:** ${item.participants} Kişi
- **Mesafe / Yakınlık:** ${item.minDistance}
- **İnceleme Durumu:** ${item.status === 'verified' ? 'Doğrulandı (Önemli / Şüpheli Görüşme)' : item.status === 'dismissed' ? 'Elenmiş (Yanlış Alarm)' : 'İncelenmedi'}
`).join('\n')}

---

## ✂️ FFmpeg Kayıpsız Kesim Komutları

\`\`\`bash
# Bu olayları saniyeler içinde orijinal kalitede kesip dışa aktarmak için komutlar:
${list.map((item, idx) => {
      const padStart = formatTime(Math.max(0, item.startTime - 2));
      const padEnd = formatTime(item.endTime + 2);
      const outName = `${activeCamera.name.replace(/\.[^/.]+$/, '')}_Olay_${String(idx + 1).padStart(2, '0')}.mp4`;
      return `ffmpeg -ss ${padStart} -to ${padEnd} -i "${activeCamera.name}" -c copy -avoid_negative_ts make_zero "${outName}"`;
    }).join('\n')}
\`\`\`
`;
  };

  // Download Markdown file
  const handleDownloadMarkdown = (onlyVerified = false) => {
    if (!activeCamera) return;
    const content = generateMarkdownReport(onlyVerified);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCamera.name.replace(/\.[^/.]+$/, '')}_Inceleme_Raporu.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Markdown (.md) rapor dosyası başarıyla indirildi!');
  };

  // Generate Complete Standalone Printable Forensic HTML Report (with Base64 Snapshots)
  const generateVisualHtmlReport = (onlyVerified = false): string => {
    if (!activeCamera) return '';
    const list = onlyVerified
      ? activeCamera.interactions.filter(i => i.status === 'verified')
      : activeCamera.interactions;

    const camStartTime = activeCamera.startTime || cameraStartTime || '08:00:00';
    const reportDate = new Date().toLocaleString('tr-TR');
    const totalDurationStr = formatTime(activeCamera.duration);
    const totalVerifiedTime = list.filter(i => i.status === 'verified').reduce((acc, cur) => acc + cur.duration, 0);
    const camStartFull = activeCamera.startDate
      ? `${activeCamera.startDate.split('-').reverse().join('.')} ${camStartTime}`
      : camStartTime;

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>CCTV Görsel İnceleme & Olay Tutanağı - ${activeCamera.name}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    body {
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 24px;
      font-size: 13px;
      line-height: 1.5;
    }
    .no-print-bar {
      background: #0f172a;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .btn {
      background: #0284c7;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn:hover { background: #0369a1; }
    .btn-secondary {
      background: #334155;
    }
    .btn-secondary:hover { background: #475569; }

    /* Header */
    .header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .badge-tc {
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 800;
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      display: inline-block;
      margin-bottom: 4px;
    }
    .title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .header-meta {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: white;
      border: 1px solid #e2e8f0;
      padding: 12px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .stat-value {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    /* Section Title */
    .section-title {
      font-size: 13px;
      text-transform: uppercase;
      color: #334155;
      font-weight: 700;
      margin-bottom: 12px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Incident Cards */
    .incident-card {
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      margin-bottom: 14px;
      padding: 12px;
      page-break-inside: avoid;
      display: flex;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .incident-img-container {
      width: 220px;
      height: 124px;
      background: #0f172a;
      border-radius: 6px;
      overflow: hidden;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #94a3b8;
    }
    .incident-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .no-img {
      color: #94a3b8;
      font-size: 11px;
      text-align: center;
      line-height: 1.4;
      padding: 8px;
    }

    .incident-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
    }
    .incident-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .incident-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .badge-verified {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .badge-pending {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .badge-dismissed {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #cbd5e1;
    }

    .time-tag {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      font-weight: 700;
      color: #0369a1;
    }
    .real-time-tag {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      color: #d97706;
      font-weight: 600;
      display: block;
      margin-top: 2px;
    }

    .note-box {
      background: #f8fafc;
      border-left: 3px solid #0284c7;
      padding: 6px 10px;
      margin: 6px 0;
      font-size: 12px;
      color: #1e293b;
      border-radius: 0 4px 4px 0;
      line-height: 1.4;
    }

    .meta-row {
      display: flex;
      gap: 16px;
      font-size: 11px;
      color: #64748b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      padding-top: 4px;
      border-top: 1px solid #f1f5f9;
    }
    .meta-item strong {
      color: #0f172a;
    }

    /* Sign-off */
    .sign-section {
      margin-top: 36px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 18px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .sign-box {
      width: 220px;
      text-align: center;
    }
    .sign-line {
      border-bottom: 1px solid #0f172a;
      height: 48px;
      margin-bottom: 6px;
    }

    @media print {
      body {
        background: white;
        padding: 0;
        margin: 0;
      }
      .no-print-bar {
        display: none !important;
      }
      .incident-card {
        box-shadow: none;
        border-color: #cbd5e1;
      }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <div>
      <strong style="font-size: 14px;">🛡️ CCTV Görsel İnceleme & Olay Tutanağı</strong>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
        Bu sayfa bağımsız (self-contained) olarak üretilmiştir. Doğrudan yazdırabilir, PDF yapabilir veya tek dosya olarak kaydedebilirsiniz.
      </div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="window.close()">✕ Kapat</button>
      <button class="btn" onclick="window.print()">🖨️ PDF Olarak Kaydet / Yazdır</button>
    </div>
  </div>

  <div class="header">
    <div>
      <span class="badge-tc">İNCELEME MERKEZİ</span>
      <h1 class="title">CCTV Görsel Olay & İnceleme Tutanağı</h1>
      <div class="subtitle">İncelenen Dosya: <strong>${activeCamera.name}</strong> • Tutanak Tarihi: ${reportDate}</div>
    </div>
    <div class="header-meta">
      <div>Çözünürlük: <strong>${activeCamera.resolution}</strong></div>
      <div>FPS: <strong>${activeCamera.fps}</strong> • Boyut: <strong>${activeCamera.size}</strong></div>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Toplam Kayıt Süresi</div>
      <div class="stat-value">${totalDurationStr}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Raporlanan Olay</div>
      <div class="stat-value">${list.length} Adet</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Doğrulanan Temas Süresi</div>
      <div class="stat-value" style="color: #16a34a;">${totalVerifiedTime} sn</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Kayıt Başlangıç Saati</div>
      <div class="stat-value" style="color: #d97706; font-size: 14px;">${camStartFull}</div>
    </div>
  </div>

  <div class="section-title">
    <span>Kronolojik Olay ve Görüşme Kayıtları</span>
    <span style="font-size: 11px; font-weight: normal; color: #64748b;">(Toplam ${list.length} Olay / Tespit)</span>
  </div>

  ${list.length === 0 ? `
    <div style="text-align: center; padding: 40px; color: #64748b; background: white; border: 1px dashed #cbd5e1; border-radius: 8px;">
      Bu kapsamda raporlanacak olay bulunamadı.
    </div>
  ` : list.map((item, idx) => {
      const isVer = item.status === 'verified';
      const isDis = item.status === 'dismissed';
      const statusText = isVer ? '✓ Doğrulandı' : isDis ? '✕ Elenmiş (Yanlış Alarm)' : '⏳ Beklemede / İnceleniyor';
      const badgeClass = isVer ? 'badge-verified' : isDis ? 'badge-dismissed' : 'badge-pending';
      const realTimeStart = formatClockTime(item.startTime, camStartTime, activeCamera.startDate, true);
      const realTimeEnd = formatClockTime(item.endTime, camStartTime, activeCamera.startDate, false);

      return `
    <div class="incident-card">
      <div class="incident-img-container">
        ${item.snapshot
          ? `<img src="${item.snapshot}" class="incident-img" alt="Olay #${idx + 1}" />`
          : `<div class="no-img">📷 Görsel Yakalanmadı<br><span style="font-size: 10px; color: #64748b;">(${formatTime(item.startTime)})</span></div>`
        }
      </div>
      <div class="incident-info">
        <div>
          <div class="incident-top">
            <div>
              <span class="time-tag">#${String(idx + 1).padStart(2, '0')} • ${formatTime(item.startTime)} - ${formatTime(item.endTime)} (${item.duration} sn)</span>
              <span class="real-time-tag">⏰ Adli Kayıt Saati: ${realTimeStart} - ${realTimeEnd}</span>
            </div>
            <span class="incident-badge ${badgeClass}">${statusText}</span>
          </div>
          
          <div class="note-box">
            <strong>Olay Notu:</strong> ${item.note || 'Özel açıklama girilmedi.'}
          </div>
        </div>

        <div class="meta-row">
          <div class="meta-item">Tespit Edilen Kişi: <strong>${item.participants} Kişi</strong></div>
          <div class="meta-item">Mesafe: <strong>${item.minDistance}</strong></div>
          <div class="meta-item">Algoritma Güven: <strong>%${item.confidence}</strong></div>
        </div>
      </div>
    </div>
    `;
    }).join('')}

  <div class="sign-section">
    <div class="sign-box">
      <div class="sign-line"></div>
      <div style="font-weight: 700; font-size: 12px;">İncelemeyi Yapan Uzman / Görevli</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Adı Soyadı / Unvan / İmza</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div style="font-weight: 700; font-size: 12px;">Birim Amiri / Onaylayan Yetkili</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Adı Soyadı / Unvan / Mühür</div>
    </div>
  </div>

</body>
</html>`;
  };

  // Open Visual HTML Report in new tab with print & save buttons
  const openVisualHtmlReport = (onlyVerified = false) => {
    if (!activeCamera) return;
    const htmlContent = generateVisualHtmlReport(onlyVerified);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Açılır pencere tarayıcı tarafından engellendi. Lütfen izin veriniz.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Download standalone HTML report file
  const handleDownloadHtmlReport = (onlyVerified = false) => {
    if (!activeCamera) return;
    const content = generateVisualHtmlReport(onlyVerified);
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCamera.name.replace(/\.[^/.]+$/, '')}_Gorsel_Adli_Rapor.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Görsel Adli Rapor (.html) başarıyla indirildi!');
  };

  // Download Windows .BAT script
  const handleDownloadBatScript = () => {
    if (!activeCamera) return;
    const list = activeCamera.interactions;
    if (!list.length) {
      showToast('Kesilecek olay bulunmuyor.');
      return;
    }

    const lines = [
      '@echo off',
      'chcp 65001 > nul',
      'echo ==========================================================',
      `echo CCTV Toplu Kesim Scripti - ${activeCamera.name}`,
      'echo ==========================================================',
      'mkdir "Kesilen_Olaylar" 2>nul',
      '',
      ...list.map((item, idx) => {
        const padStart = formatTime(Math.max(0, item.startTime - 2));
        const padEnd = formatTime(item.endTime + 2);
        const outName = `Kesilen_Olaylar\\${activeCamera.name.replace(/\.[^/.]+$/, '')}_Olay_${String(idx + 1).padStart(2, '0')}.mp4`;
        return `ffmpeg -ss ${padStart} -to ${padEnd} -i "${activeCamera.name}" -c copy -avoid_negative_ts make_zero "${outName}"`;
      }),
      '',
      'echo.',
      'echo ==========================================================',
      `echo Tum ${list.length} adet olay basariyla 'Kesilen_Olaylar' klasorune aktarildi!`,
      'echo ==========================================================',
      'pause'
    ];

    const content = lines.join('\r\n');
    const blob = new Blob([content], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCamera.name.replace(/\.[^/.]+$/, '')}_Kesim_Scripti.bat`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Windows .BAT kesim dosyası indirildi!');
  };

  // Export Project Data as JSON
  const handleExportProjectJSON = () => {
    const projectData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      cameraStartTime,
      cameras: cameras.map(({ fileObject, ...rest }) => rest)
    };
    const jsonStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cctv_proje_yedek_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Proje yedeği (.json) başarıyla indirildi!');
  };

  // Import Project Data from JSON
  const handleImportProjectJSON = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data.cameras)) {
          const defaultStart = data.cameraStartTime || cameraStartTime || '08:00:00';
          const restoredCams = data.cameras.map((c: any) => ({
            ...c,
            startTime: c.startTime || defaultStart
          }));
          setCameras(restoredCams);
          if (restoredCams.length > 0) {
            setActiveCamId(restoredCams[0].id);
          }
          if (data.cameraStartTime) {
            setCameraStartTime(data.cameraStartTime);
          }
          showToast('Proje yedeği başarıyla geri yüklendi!');
          setShowBackupModal(false);
        } else {
          showToast('Geçersiz proje dosyası formatı.');
        }
      } catch {
        showToast('JSON dosyası okunurken hata oluştu.');
      }
    };
    reader.readAsText(file);
  };

  // Total duration of all queued cameras
  const totalQueueDuration = useMemo(() => {
    return cameras.reduce((acc, c) => acc + (c.duration || 0), 0);
  }, [cameras]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden relative ${isDragging ? 'ring-4 ring-cyan-500/80' : ''
        }`}
    >

      {/* 1. SURVEILLANCE TOP HEADER */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0 backdrop-blur z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-wide text-white uppercase">CCTV Görüntü & Görüşme Tarayıcısı</span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 rounded">
                FORENSIC
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center space-x-2">
              <span>Aktif Kamera:</span>
              <span className="text-emerald-400 font-mono font-medium truncate max-w-xs">
                {activeCamera ? activeCamera.name : 'Video Yüklenmedi'}
              </span>
              {activeCamera && (
                <>
                  <span className="text-slate-600">•</span>
                  <span>{activeCamera.resolution}</span>
                  <span className="text-slate-600">•</span>
                  <button
                    onClick={() => openTimeEditModal(activeCamera)}
                    className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[11px] transition cursor-pointer"
                    title="Bu videonun başlangıç tarih ve saatini düzenle"
                  >
                    <Calendar className="w-3 h-3 text-amber-400" />
                    <span>
                      {activeCamera.startDate
                        ? `${activeCamera.startDate.split('-').reverse().join('.')} ${activeCamera.startTime || cameraStartTime}`
                        : `Başlangıç: ${activeCamera.startTime || cameraStartTime}`}
                    </span>
                    <Edit3 className="w-2.5 h-2.5 text-amber-400/70" />
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center space-x-2">
          {/* Queue Count */}
          <div className="hidden xl:flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs">
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300">Kuyruk:</span>
            <span className="font-mono font-bold text-white">{cameras.length} Video</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-mono">
              {cameras.filter(c => c.status === 'completed').length} Taranmış
            </span>
          </div>

          {/* Backup & Auto-Save Center */}
          <button
            onClick={() => setShowBackupModal(true)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
            title="Yedekleme & Proje Yükleme"
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Yedekle / Proje</span>
          </button>

          {/* Fast Scanning Button */}
          {activeCamera && (
            <div className="flex items-center space-x-1">
              <button
                onClick={runRapidScanner}
                disabled={isScanningActive}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition shadow-sm ${isScanningActive
                  ? 'bg-amber-600/50 text-amber-200 cursor-not-allowed border border-amber-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50 border border-emerald-500'
                  }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningActive ? 'animate-spin' : ''}`} />
                <span>{isScanningActive ? `%${scanProgress} Taranıyor...` : 'Otomatik Görüşme Tara'}</span>
              </button>
              {isScanningActive && (
                <button
                  onClick={cancelScanner}
                  className="px-2 py-1.5 rounded-md bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700 text-xs transition"
                  title="Taramayı Durdur"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Export Report Center */}
          {activeCamera && (
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/80 text-xs text-indigo-200 font-medium transition cursor-pointer"
              title="Görsel Adli Rapor (PDF) veya Markdown Raporu Al"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Adli Rapor Al</span>
            </button>
          )}

          {/* Export FFmpeg Script */}
          {activeCamera && (
            <button
              onClick={() => setShowFfmpegModal(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
              title="FFmpeg Kesim Komutları"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline">FFmpeg Kesim</span>
            </button>
          )}

          {/* Video Enhancement / Light & Contrast */}
          <button
            onClick={() => setShowEnhanceMenu(!showEnhanceMenu)}
            className={`p-2 rounded-md border text-xs transition ${showEnhanceMenu
              ? 'bg-amber-950 border-amber-500 text-amber-300'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
              }`}
            title="Görüntü İyileştirme (Zoom / Işık / Kontrast)"
          >
            <Sun className="w-4 h-4" />
          </button>

          {/* Quick Settings */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
            title="Tarama Parametreleri & Saat Farkı"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Keyboard Shortcuts Guide */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 hover:text-white transition"
            title="Klavye Kısayolları (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN APPLICATION WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT COLUMN: Camera File Playlist / Queue */}
        <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Video className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Video Kuyruğu</span>
            </div>
            <label className="cursor-pointer text-[11px] flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80">
              <Upload className="w-3 h-3" />
              <span>+ Dosya Seç</span>
              <input
                type="file"
                multiple
                accept="video/mp4,video/webm,video/mkv,video/avi"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Multi-part batch actions toolbar */}
          {cameras.length > 1 && (
            <div className="px-2.5 py-1.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-[10px]">
              <button
                onClick={() => autoChainCameraTimes()}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer"
                title="Tüm parçaların başlangıç saatlerini video sürelerine göre zincirle"
              >
                <Link2 className="w-2.5 h-2.5 text-amber-400" />
                <span>Saatleri Zincirle</span>
              </button>
              <button
                onClick={sortCamerasNaturally}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                title="Dosya adına göre doğal sırala (Parça 1, Parça 2...)"
              >
                <ArrowUpDown className="w-2.5 h-2.5 text-cyan-400" />
                <span>Sırala</span>
              </button>
            </div>
          )}

          {/* Video List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2 space-y-1">
            {cameras.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 space-y-2 p-4">
                <Video className="w-8 h-8 text-slate-600" />
                <p className="text-xs">Kuyrukta video bulunmuyor.</p>
                <label className="cursor-pointer px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs inline-flex items-center space-x-1">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Video Ekle</span>
                  <input
                    type="file"
                    multiple
                    accept="video/mp4,video/webm,video/mkv,video/avi"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              cameras.map((cam, idx) => {
                const isSelected = cam.id === activeCamId;
                const isFileLinked = Boolean(cam.fileObject);
                const isDraggingThis = draggedCamIdx === idx;
                const isDragOverThis = dragOverCamIdx === idx;

                return (
                  <div
                    key={cam.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(idx));
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedCamIdx(idx);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverCamIdx !== idx) setDragOverCamIdx(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverCamIdx === idx) setDragOverCamIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const sourceIdx = draggedCamIdx;
                      setDraggedCamIdx(null);
                      setDragOverCamIdx(null);
                      if (sourceIdx !== null && sourceIdx !== idx) {
                        handleReorderCameras(sourceIdx, idx);
                      }
                    }}
                    onDragEnd={() => {
                      setDraggedCamIdx(null);
                      setDragOverCamIdx(null);
                    }}
                    onClick={() => handleSelectCamera(cam)}
                    className={`p-2.5 rounded-lg cursor-pointer transition text-left flex flex-col space-y-1.5 group relative ${isDraggingThis
                      ? 'opacity-40 border-dashed border-cyan-500 bg-slate-950'
                      : isDragOverThis
                        ? 'border-t-2 border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-950/50'
                        : isSelected
                          ? 'bg-slate-800 border border-emerald-500/40 shadow-sm shadow-emerald-950/30'
                          : 'hover:bg-slate-850 bg-slate-900/40 border border-slate-800/50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 truncate pr-2">
                        <span title="Sırayı değiştirmek için sürükleyin" className="shrink-0 flex items-center">
                          <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 hover:text-cyan-400 cursor-grab active:cursor-grabbing transition" />
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">#{String(idx + 1).padStart(2, '0')}</span>
                        <span className={`text-xs font-medium truncate ${isSelected ? 'text-emerald-300' : 'text-slate-300'}`}>
                          {cam.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        {cam.status === 'completed' && (
                          <span className="px-1.5 py-0.2 text-[9px] rounded font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                            {cam.detectedCount} Olay
                          </span>
                        )}
                        {cam.status === 'scanning' && (
                          <span className="px-1.5 py-0.2 text-[9px] rounded font-mono bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                            Taranıyor
                          </span>
                        )}
                        <button
                          onClick={(e) => handleRemoveCamera(cam.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 transition"
                          title="Kuyruktan Kaldır"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate">{cam.size}</span>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {cam.duration > 0 ? formatTime(cam.duration) : '--:--:--'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{cam.resolution}</span>
                      {!isFileLinked && (
                        <span className="text-amber-400 text-[9px]">⚠️ Dosyayı Bağla</span>
                      )}
                    </div>

                    {/* Timecode & Date row */}
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/50">
                      <div className="flex flex-col truncate pr-1">
                        {cam.startDate && (
                          <span className="text-[9px] text-cyan-400 font-mono flex items-center space-x-1">
                            <Calendar className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                            <span>{cam.startDate.split('-').reverse().join('.')}</span>
                          </span>
                        )}
                        <span className="text-amber-400 font-mono flex items-center space-x-1 truncate">
                          <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span>{cam.startTime || '08:00:00'}</span>
                          {cam.duration > 0 && (() => {
                            const end = addSecondsToDateTime(cam.startDate, cam.startTime, cam.duration);
                            return (
                              <span className="text-slate-500 text-[9px] shrink-0">
                                → {end.dateStr !== cam.startDate ? `${end.dateStr.split('-').reverse().join('.')} ${end.timeStr}` : end.timeStr}
                              </span>
                            );
                          })()}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openTimeEditModal(cam);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-700/50 transition shrink-0 cursor-pointer"
                        title="Başlangıç tarih ve saatini düzenle"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Queue Stats */}
          {cameras.length > 0 && (
            <div className="p-3 border-t border-slate-800 bg-slate-900/80 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Toplam Video:</span>
                <span className="font-mono text-slate-200">{cameras.length} Adet</span>
              </div>
              <div className="flex justify-between">
                <span>Toplam Süre:</span>
                <span className="font-mono text-emerald-400">{formatTime(totalQueueDuration)}</span>
              </div>
            </div>
          )}
        </aside>

        {/* CENTER COLUMN: Real Video Player Stage + Forensic Canvas + Controls */}
        <main className="flex-1 flex flex-col bg-slate-950 min-w-0">

          <div
            onWheel={handleVideoWheel}
            onMouseDown={handleMouseDownPan}
            onMouseMove={handleMouseMovePan}
            onMouseUp={handleMouseUpPan}
            className="relative flex-1 bg-black flex items-center justify-center overflow-hidden select-none"
          >
            {activeCamera && localVideoUrl ? (
              <video
                ref={videoRef}
                src={localVideoUrl}
                className="max-h-full max-w-full object-contain pointer-events-none"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                  transition: isDraggingPan ? 'none' : 'transform 0.1s ease-out'
                }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  const dur = video.duration;
                  const w = video.videoWidth;
                  const h = video.videoHeight;
                  if (!isNaN(dur) && dur > 0) {
                    setCameras(prev => prev.map(c => c.id === activeCamId ? {
                      ...c,
                      duration: Math.round(dur),
                      resolution: w && h ? `${w}x${h}` : '1080p'
                    } : c));
                  }
                }}
                muted={isMuted}
              />
            ) : activeCamera && !localVideoUrl ? (
              /* Re-link state after browser page refresh */
              <div className="flex flex-col items-center justify-center p-8 text-center max-w-md space-y-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-white">Video Dosyası Bağlantısı Gerekiyor</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sayfa yenilendiği için tarayıcı güvenlik politikası gereği video dosyasını yeniden seçmeniz gerekir.
                  <span className="text-emerald-400 block font-medium mt-1">İşaretlediğiniz tüm olaylar ve notlar korundu!</span>
                </p>
                <label className="cursor-pointer px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition inline-flex items-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>"{activeCamera.name}" Dosyasını Bağla</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/mkv,video/avi"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && activeCamera) {
                        handleRelinkFile(activeCamera.id, file);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              /* Drag & Drop Upload Zone */
              <div className="flex flex-col items-center justify-center p-8 text-center max-w-lg space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">CCTV Video Dosyalarını Yükleyin</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    İncelemek istediğiniz güvenlik kamerası kayıtlarını (.mp4, .webm, .mkv, .avi) buraya sürükleyip bırakın veya seçin.
                  </p>
                </div>
                <label className="cursor-pointer px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg shadow-lg shadow-cyan-950/50 flex items-center space-x-2 transition">
                  <Plus className="w-4 h-4" />
                  <span>Bilgisayardan Dosya Seç</span>
                  <input
                    type="file"
                    multiple
                    accept="video/mp4,video/webm,video/mkv,video/avi"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <div className="text-[11px] text-slate-500 flex items-center space-x-3 pt-2">
                  <span>✓ Otomatik Kayıt (Veri Kaybı Yok)</span>
                  <span>•</span>
                  <span>✓ Dijital Zoom & Pan</span>
                  <span>•</span>
                  <span>✓ 64x Akıllı Hız</span>
                </div>
              </div>
            )}

            {/* Quick Speed HUD Overlay */}
            {activeCamera && playbackRate !== 1 && (
              <div className="absolute top-4 left-4 bg-slate-900/80 border border-cyan-500/40 text-cyan-300 px-2.5 py-1 rounded text-xs font-mono backdrop-blur pointer-events-none">
                HIZ: {playbackRate}x {playbackRate >= 16 && '(Akıllı Tarama)'}
              </div>
            )}

            {/* Active IN Mark Indicator on Screen */}
            {markInTime !== null && (
              <div className="absolute top-4 right-4 bg-emerald-950/90 border border-emerald-500 text-emerald-300 px-3 py-1.5 rounded text-xs font-mono backdrop-blur flex items-center space-x-1.5 animate-pulse">
                <Bookmark className="w-4 h-4 text-emerald-400" />
                <span>Giriş [IN]: {formatTime(markInTime)} • Çıkış için ']' basın</span>
              </div>
            )}

            {/* Floating Zoom & Light Control Overlay */}
            {activeCamera && showEnhanceMenu && (
              <div className="absolute bottom-4 right-4 bg-slate-900/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md w-64 space-y-3 z-30 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="font-semibold text-white">Görüntü İyileştirme</span>
                  <button onClick={() => setShowEnhanceMenu(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                {/* Zoom */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Dijital Zoom (Büyüteç):</span>
                    <span className="font-mono text-cyan-400 font-bold">%{Math.round(zoom * 100)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.1"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="flex-1 accent-cyan-500"
                    />
                    <button
                      onClick={() => setZoom(z => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    {zoom > 1 && (
                      <button
                        onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400"
                        title="Sıfırla"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {zoom > 1 && (
                    <span className="text-[10px] text-cyan-400 mt-0.5 block">💡 Ekrana basılı tutup kaydırabilirsiniz</span>
                  )}
                </div>

                {/* Brightness */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Parlaklık (Loş Koridor):</span>
                    <span className="font-mono text-amber-400 font-bold">%{brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="220"
                    step="5"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Contrast */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Kontrast:</span>
                    <span className="font-mono text-emerald-400 font-bold">%{contrast}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="220"
                    step="5"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                      setBrightness(100);
                      setContrast(100);
                    }}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Tümünü Sıfırla
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* TIMELINE HEATMAP & SCRUBBER */}
          {activeCamera && (
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 shrink-0 flex flex-col space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="text-emerald-400 font-semibold">{formatTime(currentTime)}</span>
                  {showClockTime && (
                    <button
                      onClick={() => openTimeEditModal(activeCamera)}
                      className="text-amber-400 font-semibold hover:text-amber-300 hover:underline flex items-center space-x-1 cursor-pointer"
                      title="Videonun başlangıç tarih ve saatini düzenle"
                    >
                      <span>[{formatClockTime(currentTime, activeCamera.startTime || cameraStartTime, activeCamera.startDate, true)}]</span>
                      <Edit3 className="w-3 h-3 text-amber-400/60 inline" />
                    </button>
                  )}
                  <span className="text-slate-600">/</span>
                  <span>{formatTime(activeCamera.duration)}</span>
                </div>
                <div className="flex items-center space-x-4 text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#10b981' }}></span>
                    <span>Doğrulanmış Olay ({activeCamera.interactions.filter(i => i.status === 'verified').length})</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#f59e0b' }}></span>
                    <span>İncelenecek ({activeCamera.interactions.filter(i => i.status === 'pending').length})</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#64748b' }}></span>
                    <span>Elenmiş ({activeCamera.interactions.filter(i => i.status === 'dismissed').length})</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block"></span>
                    <span>Sakin Sahne</span>
                  </div>
                </div>
              </div>

              {/* Heatmap Bar */}
              <div
                className="relative w-full h-7 bg-slate-950 rounded cursor-pointer border border-slate-800 overflow-hidden group select-none"
                onClick={(e) => {
                  if (!activeCamera.duration) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  const target = ratio * activeCamera.duration;
                  setCurrentTime(target);
                  if (videoRef.current) videoRef.current.currentTime = target;
                }}
              >
                {/* Interaction Heat Zones */}
                {activeCamera.duration > 0 && activeCamera.interactions.map((intItem) => {
                  const leftPct = (intItem.startTime / activeCamera.duration) * 100;
                  const widthPct = Math.max(0.6, ((intItem.endTime - intItem.startTime) / activeCamera.duration) * 100);
                  const isItemVerified = intItem.status === 'verified';
                  const isItemDismissed = intItem.status === 'dismissed';
                  const isSelected = selectedInteractionId === intItem.id;

                  return (
                    <div
                      key={intItem.id}
                      title={`Olay: ${formatTime(intItem.startTime)} - ${formatTime(intItem.endTime)} (${intItem.duration}s)\n${intItem.note}`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: isItemVerified
                          ? 'rgba(16, 185, 129, 0.85)'
                          : isItemDismissed
                            ? 'rgba(100, 116, 139, 0.85)'
                            : 'rgba(245, 158, 11, 0.85)'
                      }}
                      className={`absolute top-0 bottom-0 transition-opacity ${isSelected ? 'ring-2 ring-white z-10' : ''
                        } ${isItemVerified
                          ? 'hover:brightness-125'
                          : isItemDismissed
                            ? 'hover:brightness-125'
                            : 'hover:brightness-125'
                        }`}
                    />
                  );
                })}

                {/* Mark In Selection Span */}
                {markInTime !== null && activeCamera.duration > 0 && (
                  <div
                    style={{
                      left: `${(Math.min(markInTime, currentTime) / activeCamera.duration) * 100}%`,
                      width: `${(Math.abs(currentTime - markInTime) / activeCamera.duration) * 100}%`
                    }}
                    className="absolute top-0 bottom-0 bg-emerald-500/30 border-l-2 border-r-2 border-emerald-400 pointer-events-none"
                  />
                )}

                {/* Progress Fill */}
                {activeCamera.duration > 0 && (
                  <>
                    <div
                      style={{ width: `${(currentTime / activeCamera.duration) * 100}%` }}
                      className="absolute top-0 bottom-0 left-0 bg-cyan-500/20 border-r-2 border-cyan-400 pointer-events-none"
                    />
                    <div
                      style={{ left: `${(currentTime / activeCamera.duration) * 100}%` }}
                      className="absolute top-0 bottom-0 w-0.5 bg-cyan-300 pointer-events-none shadow-[0_0_8px_#06b6d4]"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* PLAYBACK CONTROLS & PRECISION BUTTONS */}
          {activeCamera && (
            <div className="bg-slate-900/90 border-t border-slate-800/80 px-4 py-2 flex items-center justify-between shrink-0">
              {/* Left: Frame-by-frame and step navigation */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => {
                    const target = Math.max(0, currentTime - 5);
                    setCurrentTime(target);
                    if (videoRef.current) videoRef.current.currentTime = target;
                  }}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  title="5 saniye geri (←)"
                >
                  <Rewind className="w-4 h-4" />
                </button>
                <button
                  onClick={() => stepFrame(false)}
                  className="p-1.5 rounded hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 transition"
                  title="1 Kare Geri (0.04 sn) - Kısayol: ,"
                >
                  <StepBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const target = Math.max(0, currentTime - 1);
                    setCurrentTime(target);
                    if (videoRef.current) videoRef.current.currentTime = target;
                  }}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  title="1 saniye geri (Shift + ←)"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                {/* Play / Pause Toggle */}
                <button
                  onClick={() => {
                    const state = !isPlaying;
                    setIsPlaying(state);
                    if (videoRef.current) {
                      if (state) videoRef.current.play();
                      else videoRef.current.pause();
                    }
                  }}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center space-x-1 transition shadow-sm"
                  title="Oynat / Durdur (Boşluk)"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                  <span className="text-xs">{isPlaying ? 'Durdur' : 'Oynat'}</span>
                </button>

                <button
                  onClick={() => {
                    const target = Math.min(activeCamera.duration, currentTime + 1);
                    setCurrentTime(target);
                    if (videoRef.current) videoRef.current.currentTime = target;
                  }}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  title="1 saniye ileri (Shift + →)"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  onClick={() => stepFrame(true)}
                  className="p-1.5 rounded hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 transition"
                  title="1 Kare İleri (0.04 sn) - Kısayol: ."
                >
                  <StepForward className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const target = Math.min(activeCamera.duration, currentTime + 5);
                    setCurrentTime(target);
                    if (videoRef.current) videoRef.current.currentTime = target;
                  }}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                  title="5 saniye ileri (→)"
                >
                  <FastForward className="w-4 h-4" />
                </button>

                <div className="h-4 w-[1px] bg-slate-800 mx-1"></div>

                {/* In / Out Precision Interval Buttons */}
                <button
                  onClick={handleSetMarkIn}
                  className={`px-2 py-1 rounded text-xs font-mono font-medium border transition ${markInTime !== null
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  title="Giriş Noktası Belirle (Kısayol: [ )"
                >
                  [ IN
                </button>
                <button
                  onClick={handleSetMarkOut}
                  className="px-2 py-1 rounded text-xs font-mono font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
                  title="Çıkış Noktası ve Olayı Kaydet (Kısayol: ] )"
                >
                  OUT ]
                </button>

                {/* Quick Add at current second */}
                <button
                  onClick={handleAddManualInteraction}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-xs text-cyan-300 font-medium transition"
                  title="Şu anki zamana olay/aralık ekle (Kısayol: M veya I)"
                >
                  <Plus className="w-3 h-3" />
                  <span>İşaretle (M)</span>
                </button>
              </div>

              {/* Middle: Playback Speed Buttons (0.5x to 64x without blank screen) */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 px-1.5 uppercase">Hız:</span>
                {[0.5, 1, 2, 4, 8, 16, 32, 64].map((spd) => {
                  const isActive = playbackRate === spd;
                  return (
                    <button
                      key={spd}
                      onClick={() => {
                        setPlaybackRate(spd);
                        showToast(`Oynatma hızı ${spd}x olarak ayarlandı`);
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition ${isActive
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/50'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                      {spd}x
                    </button>
                  );
                })}
              </div>

              {/* Right: Audio and Snapshot Tools */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={captureSnapshot}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700"
                  title="Anlık kare yakala (Kısayol: S)"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Kare Yakala</span>
                </button>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT COLUMN: Detected Interactions Log & Incident Inspector */}
        <aside className="w-84 shrink-0 border-l border-slate-800 bg-slate-900/70 flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Olay & Tespit ({activeCamera ? activeCamera.interactions.length : 0})
              </span>
            </div>
            {activeCamera && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-2 py-0.5 text-[10px] font-mono bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded transition"
                  title="Saat ve Açıklama Listesini Toplu Yapıştır"
                >
                  + Liste Yapıştır
                </button>
                <button
                  onClick={handleAddManualInteraction}
                  className="px-2 py-0.5 text-[10px] bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded transition"
                  title="Şu anki zamana olay ekle"
                >
                  + Ekle
                </button>
              </div>
            )}
          </div>

          {/* Interactions List */}
          <div ref={eventsListRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 scroll-smooth">
            {!activeCamera ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 space-y-2 p-4">
                <Video className="w-8 h-8 text-slate-600" />
                <p className="text-xs">Bir video yüklediğinizde olaylar burada listelenir.</p>
              </div>
            ) : activeCamera.interactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 space-y-2 p-4">
                <AlertTriangle className="w-8 h-8 text-slate-600" />
                <p className="text-xs">Bu videoda henüz işaretlenmiş bir görüşme veya olay bulunmuyor.</p>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={runRapidScanner}
                    className="px-3 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded text-xs"
                  >
                    Otomatik Tara
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-3 py-1 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded text-xs"
                  >
                    Liste Yapıştır
                  </button>
                </div>
              </div>
            ) : (
              activeCamera.interactions.map((item) => {
                const isSelected = selectedInteractionId === item.id;
                const isVerified = item.status === 'verified';
                const isDismissed = item.status === 'dismissed';
                const isEditingThis = editingId === item.id;
                const isCurrentPending = currentPendingId === item.id;
                const isNowPlaying = currentTime >= item.startTime && currentTime <= item.endTime;

                return (
                  <div
                    key={item.id}
                    data-interaction-id={item.id}
                    className={`rounded-lg border p-3 flex flex-col space-y-2 transition duration-200 ${isSelected
                      ? 'border-cyan-500/70 bg-slate-800 shadow-md shadow-cyan-950/40'
                      : isNowPlaying
                        ? 'border-amber-400 bg-amber-500/10 shadow-lg shadow-amber-950/40 ring-1 ring-amber-400/40'
                        : isCurrentPending
                          ? 'border-amber-500/40 bg-slate-850 shadow-sm'
                          : isDismissed
                            ? 'border-slate-800/60 bg-slate-900/40 opacity-60 hover:opacity-100 hover:border-slate-700'
                            : 'border-slate-800 bg-slate-850 hover:border-slate-700'
                      }`}
                  >
                    {/* Top Row: Timestamp & Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col font-mono text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white">
                            {formatTime(item.startTime)} - {formatTime(item.endTime)}
                          </span>
                          {isNowPlaying && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-sans font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                              Canlı Kare
                            </span>
                          )}
                        </div>
                        {showClockTime && (
                          <span className="text-[10px] text-amber-400">
                            [{formatClockTime(item.startTime, activeCamera.startTime || cameraStartTime, activeCamera.startDate, true)} - {formatClockTime(item.endTime, activeCamera.startTime || cameraStartTime, activeCamera.startDate, false)}] [Gerçek Zaman]
                          </span>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center space-x-1 shrink-0">
                        {isVerified && (
                          <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                            <CheckCircle className="w-3 h-3" />
                            <span>Doğrulandı</span>
                          </span>
                        )}
                        {isDismissed && (
                          <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Elenmiş</span>
                          </span>
                        )}
                        {!isVerified && !isDismissed && (
                          <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800">
                            <Clock className="w-3 h-3" />
                            <span>İncelenmedi</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Snapshot Thumbnail Preview & Metadata Row */}
                    <div className="flex space-x-2.5 items-center">
                      <div className="relative w-24 h-14 bg-slate-950 rounded border border-slate-700/80 overflow-hidden shrink-0 flex items-center justify-center group/thumb">
                        {item.snapshot ? (
                          <img
                            src={item.snapshot}
                            alt="Olay Karesi"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-600 text-[9px] text-center p-1">
                            <Camera className="w-4 h-4 mb-0.5 text-slate-600" />
                            <span>Görsel Yok</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateInteractionSnapshot(item.id);
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex flex-col items-center justify-center text-[9px] text-cyan-300 transition backdrop-blur-xs cursor-pointer"
                          title="Videonun şu anki karesini bu olayın fotoğrafı olarak kaydet"
                        >
                          <Camera className="w-3.5 h-3.5 mb-0.5 text-white" />
                          <span>Kareyi Al</span>
                        </button>
                      </div>

                      {/* Metadata chips */}
                      <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-400 bg-slate-900/60 p-1.5 rounded flex-1">
                        <div>
                          <span className="text-slate-500 block text-[9px]">SÜRE</span>
                          <span className="text-cyan-300 font-bold">{item.duration} sn</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px]">KİŞİ</span>
                          <span className="text-amber-300 font-bold">{item.participants}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px]">GÜVEN</span>
                          <span className="text-emerald-300 font-bold">%{item.confidence}</span>
                        </div>
                      </div>
                    </div>

                    {/* Forensic Note with inline edit */}
                    {isEditingThis ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={editingNote}
                          onChange={(e) => setEditingNote(e.target.value)}
                          className="w-full bg-slate-950 border border-cyan-500 text-xs p-1.5 rounded text-white focus:outline-none"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex justify-end space-x-1">
                          <button
                            onClick={() => handleSaveNote(item.id)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px]"
                          >
                            Kaydet
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group/note flex items-start justify-between">
                        <p className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-slate-700 pl-2">
                          "{item.note}"
                        </p>
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setEditingNote(item.note);
                          }}
                          className="opacity-0 group-hover/note:opacity-100 p-1 text-slate-400 hover:text-cyan-300 transition"
                          title="Notu Düzenle"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <button
                        onClick={() => jumpToIncident(item)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1"
                      >
                        <Play className="w-3 h-3" />
                        <span>Olayı İzle (-3sn)</span>
                      </button>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => updateInteractionSnapshot(item.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                          title="Videonun şu anki karesini bu olaya fotoğraf olarak kaydet"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'verified')}
                          className={`p-1 rounded transition ${isVerified ? 'bg-emerald-950 text-emerald-400' : 'hover:bg-emerald-950 text-slate-400 hover:text-emerald-400'}`}
                          title="Doğrula (Önemli / Şüpheli Olay)"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'dismissed')}
                          className={`p-1 rounded transition ${isDismissed ? 'bg-rose-950 text-rose-400' : 'hover:bg-rose-950 text-slate-400 hover:text-rose-400'}`}
                          title="Yanlış Alarm Olarak Ele"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteInteraction(item.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition"
                          title="Kaydı Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Stats Summary */}
          {activeCamera && activeCamera.interactions.length > 0 && (
            <div className="p-3 border-t border-slate-800 bg-slate-900/90 text-xs text-slate-400 space-y-1.5">
              <div className="flex justify-between items-center">
                <span>Doğrulanmış Olay Süresi:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {formatShortDuration(
                    activeCamera.interactions
                      .filter(i => i.status === 'verified')
                      .reduce((acc, i) => acc + i.duration, 0)
                  )}
                </span>
              </div>
              <button
                onClick={() => setShowReportModal(true)}
                className="w-full mt-1 py-1.5 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-300 text-xs font-medium flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-cyan-400" />
                <span>Adli Rapor Oluştur (PDF / HTML)</span>
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* 3. MODAL: FFMPEG SCRIPT EXPORT CENTER (.BAT DESTEĞİ İLE) */}
      {showFfmpegModal && activeCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-white text-sm">FFmpeg Kayıpsız Toplu Kesim Merkezi</h3>
              </div>
              <button
                onClick={() => setShowFfmpegModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-300">
                Bu script, videonuzu tekrar encode etmeden <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300">-c copy</code> parametresiyle
                saniyeler içinde keser ve yalnızca tespit edilen görüşme/olay aralıklarını dışa aktarır:
              </p>

              {/* Code Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-emerald-300 max-h-56 overflow-y-auto whitespace-pre leading-relaxed">
                {activeCamera.interactions.length === 0 ? (
                  `# Bu video için henüz işaretlenmiş aralık yok.\n# Önce aralık ekleyin veya tarama yapın.`
                ) : (
                  `# ==============================================================
# CCTV GORUSME AYIKLAMA TOPLU KESIM SCRIPTI (BASH / WINDOWS BAT)
# ==============================================================

# ${activeCamera.name} icin tespit edilen ${activeCamera.interactions.length} aralik:
` + activeCamera.interactions.map((intItem, idx) => {
                    const padStart = formatTime(Math.max(0, intItem.startTime - 2));
                    const padEnd = formatTime(intItem.endTime + 2);
                    const outName = `${activeCamera.name.replace(/\.[^/.]+$/, '')}_Olay_${String(idx + 1).padStart(2, '0')}.mp4`;
                    return `ffmpeg -ss ${padStart} -to ${padEnd} -i "${activeCamera.name}" -c copy -avoid_negative_ts make_zero "${outName}"`;
                  }).join('\n')
                )}
              </div>

              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>• Tek tıkla indirilen .bat dosyasını video klasöründe çalıştırmanız yeterlidir.</span>
                <span>• Kalite kaybı: Sıfır (%100 orijinal kalite)</span>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-end space-x-2">
              {activeCamera.interactions.length > 0 && (
                <>
                  <button
                    onClick={handleDownloadBatScript}
                    className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center space-x-1.5 shadow-sm shadow-emerald-950"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Toplu Kesim (.bat) İndir</span>
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        activeCamera.interactions.map((intItem, idx) => {
                          const padStart = formatTime(Math.max(0, intItem.startTime - 2));
                          const padEnd = formatTime(intItem.endTime + 2);
                          const outName = `${activeCamera.name.replace(/\.[^/.]+$/, '')}_Olay_${String(idx + 1).padStart(2, '0')}.mp4`;
                          return `ffmpeg -ss ${padStart} -to ${padEnd} -i "${activeCamera.name}" -c copy -avoid_negative_ts make_zero "${outName}"`;
                        }).join('\n')
                      );
                      showToast('FFmpeg komutları panoya kopyalandı!');
                    }}
                    className="px-3.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center space-x-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Komutları Kopyala</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setShowFfmpegModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL: SCANNING PARAMETER & CLOCK OFFSET CONFIGURATION */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">Tarama, Hassasiyet & Saat Ayarları</h3>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Camera Start Time Offset & Multi-Video Sync */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-slate-200 block">Zaman Senkronizasyonu & Parçalı Videolar</span>
                    <span className="text-[10px] text-slate-400">Her video için bağımsız başlangıç saati ve otomatik ardışık zincirleme</span>
                  </div>
                  <label className="flex items-center space-x-1 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showClockTime}
                      onChange={(e) => setShowClockTime(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span>Gerçek Saati Göster</span>
                  </label>
                </div>

                {/* Active camera start time editor */}
                {activeCamera ? (
                  <div className="p-2.5 bg-slate-900/90 rounded border border-slate-700/80 space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-300">Aktif Video: <strong className="text-white">{activeCamera.name}</strong></span>
                      <span className="text-slate-400 font-mono">Süre: {formatTime(activeCamera.duration)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Başlangıç Tarihi:</label>
                        <input
                          type="date"
                          value={activeCamera.startDate || new Date().toISOString().slice(0, 10)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCameras(prev => prev.map(c => c.id === activeCamera.id ? { ...c, startDate: val } : c));
                          }}
                          className="w-full bg-slate-950 border border-slate-700 text-amber-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Başlangıç Saati:</label>
                        <input
                          type="text"
                          value={activeCamera.startTime || cameraStartTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCameras(prev => prev.map(c => c.id === activeCamera.id ? { ...c, startTime: val } : c));
                          }}
                          placeholder="08:00:00"
                          className="w-full bg-slate-950 border border-slate-700 text-amber-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    {activeCamera.duration > 0 && (() => {
                      const end = addSecondsToDateTime(activeCamera.startDate, activeCamera.startTime || cameraStartTime, activeCamera.duration);
                      return (
                        <div className="text-[10px] text-slate-400 flex justify-between pt-0.5 border-t border-slate-800/60">
                          <span>Kapsanan Zaman Aralığı:</span>
                          <span className="font-mono text-amber-400 font-semibold">
                            {formatDisplayDateTime(parseDateTime(activeCamera.startDate, activeCamera.startTime || cameraStartTime))} → {end.display}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-slate-500 text-[11px]">Kuyrukta video bulunmuyor.</p>
                )}

                {/* Multi-part batch actions toolbar */}
                {cameras.length > 1 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-medium text-slate-300">Parçalı Video Araçları ({cameras.length} Video)</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => autoChainCameraTimes()}
                        className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-xs font-medium transition cursor-pointer"
                        title="İlk videonun saatinden başlayarak tüm parçaların saatlerini ardışık olarak zincirler"
                      >
                        <Link2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Süreleri Otomatik Zincirle</span>
                      </button>
                      <button
                        type="button"
                        onClick={sortCamerasNaturally}
                        className="flex items-center justify-center space-x-1.5 py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs transition cursor-pointer"
                        title="Dosya adına göre sırala"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                        <span>İsme Göre Sırala</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      💡 <strong>Parçalı Dosyalar:</strong> Boyut limitinden bölünen videolarda (örn. <em>Honeywell_..._1.mp4, 1-1.mp4, 1-2.mp4</em>), "Süreleri Otomatik Zincirle" butonuna tıklayarak her parçanın başlangıç saatini bir önceki parçanın bittiği ana göre hesaplayabilirsiniz.
                    </p>
                  </div>
                )}
              </div>

              {/* Sensitivity Preset */}
              <div>
                <label className="font-medium text-slate-200 block mb-1.5">Hareket Algılama Hassasiyeti</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['high', 'normal', 'low'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setMotionSensitivity(mode)}
                      className={`py-2 px-3 rounded text-xs font-medium border text-center transition ${motionSensitivity === mode
                        ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                        }`}
                    >
                      {mode === 'high' ? 'Yüksek (Önerilen)' : mode === 'normal' ? 'Normal' : 'Düşük'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Yüksek hassasiyet: Beyaz koridorda açık renk elbiseli veya uzaktan geçen kişileri de tespit eder.
                </p>
              </div>

              {/* Sampling Rate Slider */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="font-medium text-slate-200">Kare Örnekleme Aralığı (Sampling Rate)</span>
                  <span className="font-mono text-cyan-400 font-bold">{samplingRate} Saniyede 1 Kare</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.5"
                  value={samplingRate}
                  onChange={(e) => setSamplingRate(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Dwell Time (Minimum duration) */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="font-medium text-slate-200">Asgari Görüşme / Geçiş Süresi (Dwell Time)</span>
                  <span className="font-mono text-emerald-400 font-bold">{minDwellTime} Saniye</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="15"
                  step="1"
                  value={minDwellTime}
                  onChange={(e) => setMinDwellTime(parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Minimum Proximity Distance */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="font-medium text-slate-200">Yakınlık Mesafe Eşiği (Proximity Threshold)</span>
                  <span className="font-mono text-amber-400 font-bold">{minDistanceThreshold} Piksel</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="250"
                  step="10"
                  value={minDistanceThreshold}
                  onChange={(e) => setMinDistanceThreshold(parseInt(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  showToast('Parametreler kaydedildi.');
                }}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs"
              >
                Kaydet ve Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: IMPORT TIMESTAMPS / LIST */}
      {showImportModal && activeCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-white text-sm">Toplu Olay / Zaman Çizelgesi İçe Aktar</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-300">
                Not aldığınız saatleri ve açıklamaları aşağıdaki kutuya yapıştırın. Sistem zaman damgalarını otomatik tespit edip zaman çizelgesine yerleştirir:
              </p>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={9}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-cyan-200 focus:outline-none focus:border-cyan-500 leading-relaxed"
                placeholder="Örnek:&#10;34:20 şüpheli geldi&#10;1:24:15 şüpheli ve avukatı geldi (3 kişi)&#10;7:03:43 avukatlar ayrıldı"
              />

              <div className="bg-slate-950 border border-slate-800/80 p-2.5 rounded text-[11px] text-slate-400 space-y-1">
                <p className="text-emerald-400 font-medium">✓ Desteklenen Formatlar:</p>
                <p>• Dakika:Saniye (Örn: <code>34:20 Şüpheli geldi</code>)</p>
                <p>• Saat:Dakika:Saniye (Örn: <code>1:24:15 Şüpheli geldi</code> veya <code>07:03:43 3 kişi geldi</code>)</p>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
              <span className="text-[11px] text-slate-400 font-mono">
                {importText.split('\n').filter(l => /^\d{1,2}:\d{2}/.test(l.trim())).length} Geçerli Satır
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  İptal
                </button>
                <button
                  onClick={handleImportIncidents}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Listeyi Zaman Çizelgesine Ekle</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: FORENSIC REPORT & EXPORT CENTER */}
      {showReportModal && activeCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-white text-sm">Adli İnceleme ve Olay Rapor Merkezi</h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Filter toggle */}
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-300 font-medium">Rapor Kapsamı:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setReportOnlyVerified(false)}
                    className={`px-3 py-1 rounded text-xs transition cursor-pointer ${!reportOnlyVerified ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    Tüm Olaylar ({activeCamera.interactions.length})
                  </button>
                  <button
                    onClick={() => setReportOnlyVerified(true)}
                    className={`px-3 py-1 rounded text-xs transition cursor-pointer ${reportOnlyVerified ? 'bg-emerald-600 text-white font-medium shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    Sadece Doğrulananlar ({activeCamera.interactions.filter(i => i.status === 'verified').length})
                  </button>
                </div>
              </div>

              {/* PRIMARY ACTION: VISUAL ADLI RAPOR (HTML / PDF) */}
              <div className="p-3.5 bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/70 rounded-xl border border-sky-600/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-sky-950/30">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-xs flex items-center space-x-1.5">
                      <Printer className="w-4 h-4 text-sky-400" />
                      <span>Görsel Adli Olay Tutanağı (A4 / PDF)</span>
                    </span>
                    <span className="px-1.5 py-0.2 bg-sky-900/90 text-sky-300 text-[10px] rounded font-mono font-bold border border-sky-700">
                      ÖNERİLEN
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Olayların 16:9 video karelerini (Base64), adli kayıt saatlerini, metrikleri ve resmi imza kutularını içeren profesyonel A4 tutanak çıktısı.
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => openVisualHtmlReport(reportOnlyVerified)}
                    className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center space-x-1.5 shadow-md shadow-sky-950/50 transition cursor-pointer"
                    title="Yeni sekmede aç ve yazdır/PDF yap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Yazdır / PDF Aç</span>
                  </button>
                  <button
                    onClick={() => handleDownloadHtmlReport(reportOnlyVerified)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center space-x-1.5 border border-slate-700 transition cursor-pointer"
                    title="Tüm görselleri içinde tek dosya HTML indir"
                  >
                    <FileDown className="w-3.5 h-3.5 text-cyan-400" />
                    <span>HTML İndir</span>
                  </button>
                </div>
              </div>

              {/* SECONDARY ACTION: MARKDOWN METİN RAPORU */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px] font-medium flex items-center space-x-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Markdown Metin Raporu Önizlemesi (.md)</span>
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generateMarkdownReport(reportOnlyVerified));
                      showToast('Rapor metni panoya kopyalandı!');
                    }}
                    className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center space-x-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Metni Kopyala</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre leading-relaxed select-text">
                  {generateMarkdownReport(reportOnlyVerified)}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                ℹ️ <strong>İpucu:</strong> Savcılık, emniyet, yönetim veya vaka dosyaları için <strong>"Yazdır / PDF Aç"</strong> butonunu kullanarak doğrudan A4 PDF çıktısı alabilir veya <strong>"HTML İndir"</strong> ile tek dosya olarak kaydedip e-posta ile gönderebilirsiniz.
              </p>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
              <button
                onClick={() => handleDownloadMarkdown(reportOnlyVerified)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center space-x-1.5 transition cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-indigo-400" />
                <span>Markdown İndir (.md)</span>
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                >
                  Kapat
                </button>
                <button
                  onClick={() => openVisualHtmlReport(reportOnlyVerified)}
                  className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center space-x-1.5 shadow-lg shadow-sky-950/50 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Raporu PDF Olarak Al</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: BACKUP & PROJECT JSON EXPORT/IMPORT */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">Proje Yedekleme & Geri Yükleme</h3>
              </div>
              <button onClick={() => setShowBackupModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-lg text-emerald-200 space-y-1">
                <span className="font-bold flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Otomatik Kayıt Devrede</span>
                </span>
                <p className="text-[11px] text-emerald-300/80">
                  İşaretlediğiniz tüm olaylar ve notlar tarayıcınızın hafızasında otomatik saklanır. Sayfayı yenileseniz dahi kaybolmaz.
                </p>
              </div>

              {/* Export JSON */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <span className="font-semibold text-white block">Projeyi Dosya Olarak Yedekle (.json)</span>
                <p className="text-[11px] text-slate-400">
                  Tüm kamera listesini, işaretli olayları ve notlarınızı bir yedek dosyası olarak indirip başka bilgisayara aktarabilirsiniz.
                </p>
                <button
                  onClick={handleExportProjectJSON}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center justify-center space-x-1.5 transition"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Proje Yedeğini İndir (.json)</span>
                </button>
              </div>

              {/* Import JSON */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <span className="font-semibold text-white block">Yedekten Proje Yükle</span>
                <p className="text-[11px] text-slate-400">
                  Daha önce indirdiğiniz bir <code>.json</code> proje yedeğini seçerek kaldığınız yerden devam edin.
                </p>
                <label className="cursor-pointer w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium flex items-center justify-center space-x-1.5 transition">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>Yedek Dosyası Seç (.json)</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportProjectJSON}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setShowBackupModal(false)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: KEYBOARD SHORTCUTS GUIDE */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Keyboard className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-white text-sm">Adli İnceleme Klavye Kısayolları</h3>
              </div>
              <button onClick={() => setShowShortcutsModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-bold">Space</span>
                  <span className="block text-[11px] text-slate-400 mt-1">Oynat / Duraklat</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-bold">+ / -</span>
                  <span className="block text-[11px] text-slate-400 mt-1">Hızı Artır / Azalt (0.5x..64x)</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-bold">0</span>
                  <span className="block text-[11px] text-slate-400 mt-1">Normal Hız (1x)</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-bold">→ / ←</span>
                  <span className="block text-[11px] text-slate-400 mt-1">5 Saniye İleri / Geri</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-bold">Shift + → / ←</span>
                  <span className="block text-[11px] text-slate-400 mt-1">1 Saniye Hassas İlerleme</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-bold">. (Nokta) / ,</span>
                  <span className="block text-[11px] text-slate-400 mt-1">1 Kare Hassas (0.04 sn) İleri/Geri</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300 font-bold">[</span>
                  <span className="block text-[11px] text-slate-400 mt-1">Olay Başlangıcı [IN] Belirle</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300 font-bold">]</span>
                  <span className="block text-[11px] text-slate-400 mt-1">Olay Bitişi [OUT] ve Kaydet</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-bold">M veya I</span>
                  <span className="block text-[11px] text-slate-400 mt-1">Şu anki zamana Olay Ekle</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-bold">S</span>
                  <span className="block text-[11px] text-slate-400 mt-1">Anlık Kareyi Kaydet (PNG)</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: CAMERA START DATE & TIME / SEQUENTIAL CHUNKS EDIT */}
      {timeEditModalCamId && (() => {
        const editCam = cameras.find(c => c.id === timeEditModalCamId);
        if (!editCam) return null;
        const camIdx = cameras.findIndex(c => c.id === timeEditModalCamId);
        const prevCam = camIdx > 0 ? cameras[camIdx - 1] : null;
        const prevEnd = prevCam && prevCam.duration > 0
          ? addSecondsToDateTime(prevCam.startDate, prevCam.startTime || '08:00:00', prevCam.duration)
          : null;
        const currentEnd = editCam.duration > 0
          ? addSecondsToDateTime(timeEditDate, timeEditValue || '08:00:00', editCam.duration)
          : null;
        const fileExtracted = extractDateTimeFromFilename(editCam.name);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full flex flex-col shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold text-white text-sm">Video Başlangıç Tarihi & Saati</h3>
                </div>
                <button onClick={() => setTimeEditModalCamId(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* File info */}
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-medium text-emerald-400 truncate flex items-center space-x-1.5">
                    <span className="font-mono text-slate-400">#{String(camIdx + 1).padStart(2, '0')}</span>
                    <span className="truncate">{editCam.name}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Video Süresi:</span>
                    <span className="font-mono text-white">{formatTime(editCam.duration)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Çözünürlük:</span>
                    <span className="font-mono text-slate-300">{editCam.resolution}</span>
                  </div>
                </div>

                {/* Input Date and Time */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-medium text-slate-200 block text-[11px]">
                      Başlangıç Tarihi
                    </label>
                    <input
                      type="date"
                      value={timeEditDate}
                      onChange={(e) => setTimeEditDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 text-amber-200 px-2.5 py-1.5 rounded font-mono text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-slate-200 block text-[11px]">
                      Başlangıç Saati
                    </label>
                    <input
                      type="text"
                      value={timeEditValue}
                      onChange={(e) => setTimeEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEditedStartTime(editCam.id, timeEditDate, timeEditValue, timeEditChainSubsequent);
                        if (e.key === 'Escape') setTimeEditModalCamId(null);
                      }}
                      placeholder="08:00:00"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 text-amber-200 px-2.5 py-1.5 rounded font-mono text-xs focus:outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Live Preview of Interval */}
                <div className="p-2.5 bg-slate-950/70 rounded border border-slate-800 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Başlangıç Zamanı:</span>
                    <span className="font-mono text-white font-medium">
                      {formatDisplayDateTime(parseDateTime(timeEditDate, timeEditValue))}
                    </span>
                  </div>
                  {currentEnd && (
                    <div className="flex justify-between pt-0.5 border-t border-slate-800/60">
                      <span className="text-slate-400">Hesaplanan Bitiş Zamanı:</span>
                      <span className="font-mono text-amber-400 font-semibold">{currentEnd.display}</span>
                    </div>
                  )}
                </div>

                {/* Quick action: inherit from previous video */}
                {prevCam && prevEnd && (
                  <button
                    type="button"
                    onClick={() => {
                      setTimeEditDate(prevEnd.dateStr);
                      setTimeEditValue(prevEnd.timeStr);
                    }}
                    className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-left flex items-center justify-between transition cursor-pointer"
                  >
                    <span>⬅️ Önceki Parçanın Bitişinden Al:</span>
                    <span className="font-mono font-bold">{prevEnd.display}</span>
                  </button>
                )}

                {/* Quick action: restore from filename */}
                {fileExtracted && (
                  <button
                    type="button"
                    onClick={() => {
                      setTimeEditDate(fileExtracted.startDate);
                      setTimeEditValue(fileExtracted.startTime);
                    }}
                    className="w-full py-1.5 px-3 bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/70 rounded text-left flex items-center justify-between text-[11px] transition cursor-pointer"
                  >
                    <span>🤖 Dosya Adındaki Orijinal Zamanı Uygula:</span>
                    <span className="font-mono font-medium">{formatDisplayDateTime(parseDateTime(fileExtracted.startDate, fileExtracted.startTime))}</span>
                  </button>
                )}

                {/* Chain subsequent files checkbox */}
                {camIdx < cameras.length - 1 && (
                  <label className="flex items-start space-x-2 text-[11px] text-slate-300 cursor-pointer pt-2 border-t border-slate-800">
                    <input
                      type="checkbox"
                      checked={timeEditChainSubsequent}
                      onChange={(e) => setTimeEditChainSubsequent(e.target.checked)}
                      className="accent-amber-500 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-white block">Sonraki parçaları da otomatik zincirle</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Bu parçanın ardından gelen ({cameras.length - camIdx - 1} adet) videonun tarih ve saatleri sürelerine göre art arda güncellenir.
                      </span>
                    </div>
                  </label>
                )}
              </div>

              <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-end space-x-2">
                <button
                  onClick={() => setTimeEditModalCamId(null)}
                  className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleSaveEditedStartTime(editCam.id, timeEditDate, timeEditValue, timeEditChainSubsequent)}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition cursor-pointer"
                >
                  Kaydet ve Uygula
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TOAST POPUP NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-14 right-6 z-50 bg-slate-900 border border-cyan-500/50 text-slate-100 text-xs px-4 py-2.5 rounded-lg shadow-xl shadow-black/80 flex items-center space-x-2 animate-bounce">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}