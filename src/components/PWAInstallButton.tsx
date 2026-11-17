import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  fullWidth?: boolean;
  onAfterClick?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  fullWidth = false,
  onAfterClick,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      onAfterClick?.();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`${
          fullWidth ? 'w-full justify-start' : ''
        } min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold text-indigo-900 bg-indigo-50 border-2 border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0`}
      >
        {isInstallable ? (
          <Download className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <Smartphone className="w-4 h-4 text-indigo-600 shrink-0" />
        )}
        <span>Application Mobile / PWA</span>
        {isInstalled && (
          <span className="ml-auto text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
            Installée
          </span>
        )}
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 p-0 sm:p-4">
          <div className="bg-white border-2 border-indigo-200 rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-indigo-950">
                  Installer Gimmo en Mode Hors-Ligne (PWA)
                </h3>
                <p className="text-xs font-medium text-slate-600 mt-0.5">
                  Accès rapide depuis l’écran d’accueil de votre téléphone ou ordinateur
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              {isIOS ? (
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1.5">
                  <p className="font-bold text-indigo-950">Sur iPhone / iPad (Safari) :</p>
                  <p>1. Appuyez sur le bouton <strong>Partager</strong> dans la barre Safari.</p>
                  <p>2. Sélectionnez <strong>Sur l’écran d’accueil</strong> pour installer Gimmo.</p>
                </div>
              ) : (
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1.5">
                  <p className="font-bold text-indigo-950">Sur Android (Chrome) ou Ordinateur :</p>
                  <p>1. Ouvrez l’application dans un onglet complet du navigateur.</p>
                  <p>2. Cliquez sur l’icône <strong>Installer Gimmo</strong> dans la barre d’adresse ou dans le menu <strong>⋮ → Installer l’application</strong>.</p>
                </div>
              )}

              <p className="text-xs font-semibold text-emerald-700">
                Vos données (biens, bailleurs, locataires, baux et quittances) sont automatiquement mises en cache sur votre appareil pour travailler sans connexion Internet.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[42px] px-4 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
