import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, RotateCcw, Image as ImageIcon, Check, AlertCircle } from 'lucide-react';
import { useBranding } from '../state/BrandingContext';
import { useTranslation } from '../i18n/LanguageContext';

const MAX_FILE_SIZE = 2.5 * 1024 * 1024; // 2.5 MB

export default function BrandingModal() {
  const { 
    isBrandingModalOpen, 
    closeBrandingModal, 
    activeLogo, 
    isCustom, 
    setCustomLogo, 
    resetToDefaultLogo,
    makeCurrentLogoDefault,
    logoWidth,
    setLogoWidth,
    resetLogoWidth
  } = useBranding();
  const { t, locale } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isBrandingModalOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isBrandingModalOpen]);

  useEffect(() => {
    if (!isBrandingModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBrandingModal();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isBrandingModalOpen, closeBrandingModal]);

  if (!isBrandingModalOpen) return null;

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const processFile = (file: File) => {
    setErrorMessage(null);

    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type) && !/\.(png|jpe?g|webp|svg)$/i.test(file.name)) {
      setErrorMessage(
        locale === 'zh'
          ? '请上传有效的图片文件 (PNG, JPG, SVG 或 WebP)'
          : 'Please upload a valid image file (PNG, JPG, SVG, or WebP)'
      );
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(
        locale === 'zh'
          ? '图片文件过大，请上传小于 2.5MB 的图片'
          : 'Image file is too large. Please select a file under 2.5MB'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        setCustomLogo(dataUrl);
        showSuccess(locale === 'zh' ? '品牌 Logo 已成功更新' : 'Branding logo updated successfully');
      } else {
        setErrorMessage(
          locale === 'zh' ? '读取图片失败，请重试' : 'Failed to read image data, please try again'
        );
      }
    };
    reader.onerror = () => {
      setErrorMessage(
        locale === 'zh' ? '读取文件出错，请重试' : 'Error reading file, please try again'
      );
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleReset = () => {
    resetToDefaultLogo();
    showSuccess(locale === 'zh' ? '已恢复为默认品牌 Logo' : 'Reset to default branding logo');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={closeBrandingModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-150 flex flex-col gap-4.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <ImageIcon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {locale === 'zh' ? '机构品牌与 Logo 定制' : 'Organization & Branding Logo'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {locale === 'zh' ? '在界面与导出的全部报告中展示自定义 Logo' : 'Displayed in app sidebar and embedded into all exported reports'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeBrandingModal}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Feedback banners */}
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
            <Check size={16} className="shrink-0 text-emerald-500" />
            <span className="flex-1">{successMessage}</span>
          </div>
        )}

        {/* Live Previews: Light and Dark background modes */}
        <div>
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
            <span>{locale === 'zh' ? '实时预览效果 (白色外框随尺寸自适应)' : 'Live Logo Previews (Adaptive White Frame)'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {isCustom ? (locale === 'zh' ? '已应用自定义 Logo' : 'Custom Logo Active') : (locale === 'zh' ? '默认品牌 Logo' : 'Default Built-in Logo')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Light preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 min-h-[90px]">
              <span className="text-[10px] text-slate-400 font-medium">{locale === 'zh' ? '浅色背景' : 'Light Background'}</span>
              <div 
                className="bg-white rounded-lg shadow-2xs border border-slate-200/80 p-1.5 inline-flex items-center justify-center transition-all duration-150"
                style={{
                  width: `${Math.round(180 * (logoWidth / 100))}px`,
                  maxWidth: '100%',
                }}
              >
                <img
                  src={activeLogo}
                  alt="Branding Preview Light"
                  className="w-full h-auto max-h-12 object-contain block"
                />
              </div>
            </div>

            {/* Dark/Sidebar preview */}
            <div className="bg-gradient-to-b from-blue-950 to-emerald-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 min-h-[90px]">
              <span className="text-[10px] text-slate-400 font-medium">{locale === 'zh' ? '深色/侧边栏背景' : 'Dark / Sidebar Background'}</span>
              <div 
                className="bg-white rounded-lg shadow-2xs border border-white/20 p-1.5 inline-flex items-center justify-center transition-all duration-150"
                style={{
                  width: `${Math.round(180 * (logoWidth / 100))}px`,
                  maxWidth: '100%',
                }}
              >
                <img
                  src={activeLogo}
                  alt="Branding Preview Dark"
                  className="w-full h-auto max-h-12 object-contain block"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logo Width Settings */}
        <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {locale === 'zh' ? 'Logo 显示宽度 (侧边栏)' : 'Logo Display Width (Sidebar)'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                {logoWidth}% {logoWidth === 100 ? (locale === 'zh' ? '(全宽)' : '(Full Width)') : ''}
              </span>
              {logoWidth !== 100 && (
                <button
                  type="button"
                  onClick={resetLogoWidth}
                  className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  {locale === 'zh' ? '重置为 100%' : 'Reset to 100%'}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="40"
              max="100"
              step="1"
              value={logoWidth}
              onChange={(e) => setLogoWidth(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-400 font-medium mr-1">
              {locale === 'zh' ? '快速预设:' : 'Presets:'}
            </span>
            {[
              { label: locale === 'zh' ? '100% 全宽' : '100% Full', val: 100 },
              { label: locale === 'zh' ? '85% 标准' : '85% Standard', val: 85 },
              { label: locale === 'zh' ? '70% 紧凑' : '70% Compact', val: 70 },
              { label: locale === 'zh' ? '50% 迷你' : '50% Mini', val: 50 },
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => setLogoWidth(preset.val)}
                className={`px-2.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  logoWidth === preset.val
                    ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Drag and Drop Upload Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 bg-slate-50/50 dark:bg-slate-950/40'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Upload size={18} />
          </div>
          <div className="text-center">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              {locale === 'zh' ? '点击选择图片' : 'Click to upload image'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {locale === 'zh' ? ' 或拖拽文件至此处' : ' or drag and drop'}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              PNG, JPG, SVG, WebP ({locale === 'zh' ? '建议透明背景，最大 2.5MB' : 'transparent background recommended, max 2.5MB'})
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {isCustom ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    makeCurrentLogoDefault();
                    showSuccess(locale === 'zh' ? '已将当前 Logo 设为默认品牌 Logo' : 'Current logo is now set as the default branding logo');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg cursor-pointer transition-colors font-medium border border-blue-200 dark:border-blue-800"
                  title={locale === 'zh' ? '将当前 Logo 保存为系统默认 Logo' : 'Set the current logo as the default logo'}
                >
                  <Check size={13} />
                  <span>{locale === 'zh' ? '设为默认 Logo' : 'Set as Default Logo'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  title={locale === 'zh' ? '重置为系统默认 Logo' : 'Reset to default logo'}
                >
                  <RotateCcw size={13} />
                  <span>{locale === 'zh' ? '恢复默认 Logo' : 'Reset to Default'}</span>
                </button>
              </>
            ) : (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Check size={13} />
                <span>{locale === 'zh' ? '当前已是默认品牌 Logo' : 'Current logo is the default logo'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeBrandingModal}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              {t('confirm', 'Done')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
