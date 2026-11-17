import React from 'react';
import {
  BookOpen,
  Download,
  Printer,
  X,
  CheckCircle2,
  MapPin,
  Users,
  FileText,
  Receipt,
  AlertTriangle,
  Sliders,
  WifiOff,
  Smartphone,
} from 'lucide-react';

interface UserGuideModalProps {
  onClose?: () => void;
  isModal?: boolean;
}

const GUIDE_CHAPTERS = [
  {
    number: '01',
    title: 'Navigation Générale & Interface Smartphone / Ordinateur',
    icon: Smartphone,
    badgeColor: 'bg-indigo-600 text-white',
    cardBorder: 'border-indigo-200 bg-indigo-50/40',
    items: [
      'Barre de navigation en 5 rubriques : Biens & Carte, Locataires & Baux, Quittances, Recouvrement et Paramétrage.',
      'Sur Smartphone (Android / iOS) : le menu horizontal se transforme automatiquement en menu vertical déroulant (« Menu : ... Déplier / Fermer ») avec des polices agrandies et lisibles.',
      'Indicateurs financiers en direct : suivez en haut à droite le nombre de biens gérés, le total encaissé sur le mois comptable actif et le nombre de dossiers en retard.',
    ],
  },
  {
    number: '02',
    title: 'Gestion des Bailleurs (Filtrer, Créer, Modifier & Supprimer)',
    icon: Users,
    badgeColor: 'bg-teal-600 text-white',
    cardBorder: 'border-teal-200 bg-teal-50/40',
    items: [
      'Sélecteur de Bailleur : situé dans la barre supérieure, il filtre instantanément la carte, les biens, les baux, les quittances et les rapports financiers.',
      'Modification & Suppression rapide : dès que vous sélectionnez un bailleur dans le menu déroulant, les boutons « Modifier » et « Supprimer » (« Confirmer ? / Annuler ») apparaissent immédiatement à côté.',
      'Bouton « Gérer les Bailleurs » : accessible à tout moment (même sur « Tous les Bailleurs ») ainsi que dans la rubrique Paramétrage pour créer un nouveau bailleur, modifier ses coordonnées/taux d’honoraires (%) ou le supprimer.',
    ],
  },
  {
    number: '03',
    title: 'Patrimoine Immobilier & Cartographie GPS (PostGIS SRID 4326)',
    icon: MapPin,
    badgeColor: 'bg-blue-600 text-white',
    cardBorder: 'border-blue-200 bg-blue-50/40',
    items: [
      'Ajout d’un Bien GPS : cliquez sur « + Ajouter un bien GPS ». L’application acquiert automatiquement les coordonnées GPS WGS84 de votre appareil (ou permet la saisie manuelle).',
      'Type de bien dynamique : choisissez parmi vos types de biens configurés ; les charges mensuelles par défaut sont automatiquement pré-remplies.',
      'Carte interactive Google Maps : repérez vos lots grâce au code couleur vif (Indigo = Occupé à jour, Ambre = Vacant disponible, Rouge = Impayé signalé).',
      'Actions par bien : utilisez les boutons « Modifier » et « Supprimer » (« Confirmer ? / Annuler ») sur chaque fiche de bien.',
    ],
  },
  {
    number: '04',
    title: 'Dossiers Locataires & Contrats de Bail PDF',
    icon: FileText,
    badgeColor: 'bg-violet-600 text-white',
    cardBorder: 'border-violet-200 bg-violet-50/40',
    items: [
      'Création d’un dossier : dans « Locataires & Baux », cliquez sur « + Nouveau Locataire & Bail » pour renseigner le locataire (CNI, WhatsApp, profession, garant) et le bien loué.',
      'Mise à jour automatique : le bien passe automatiquement au statut « Occupé » et la première quittance est générée.',
      'Contrat PDF & WhatsApp : cliquez sur « Contrat PDF » pour visualiser/télécharger le bail officiel, ou sur « WhatsApp » pour l’envoyer directement au locataire.',
      'Suppression d’un bail : cliquez sur « Supprimer » puis « Confirmer ? » ; si le bien n’a plus de bail actif, il repasse automatiquement en « Vacant ».',
    ],
  },
  {
    number: '05',
    title: 'Quittances de Loyer, Encaissements & Partage WhatsApp Cloud',
    icon: Receipt,
    badgeColor: 'bg-emerald-600 text-white',
    cardBorder: 'border-emerald-200 bg-emerald-50/40',
    items: [
      'Filtrage par Mois Comptable : sélectionnez la période souhaitée (ex: Novembre 2026, Décembre 2026...) ou affichez toutes les périodes.',
      'Création & Encaissement : cliquez sur « + Créer une Quittance » pour émettre un appel de loyer, ou cliquez sur « Encaisser » sur une ligne en attente pour valider le règlement.',
      'Export PDF & Envoi WhatsApp : cliquez sur « Quittance PDF » pour imprimer/télécharger la quittance officielle numérotée, ou sur « Envoyer WhatsApp » pour transmettre le lien PDF au locataire.',
    ],
  },
  {
    number: '06',
    title: 'Recouvrement des Impayés & Reddition des Comptes Bailleurs',
    icon: AlertTriangle,
    badgeColor: 'bg-rose-600 text-white',
    cardBorder: 'border-rose-200 bg-rose-50/40',
    items: [
      'Tableau des retards : liste automatiquement tous les locataires en dépassement d’échéance avec calcul des jours de retard et du reste à recouvrer.',
      'Relance WhatsApp en 1 clic : génère un message de relance personnalisé avec le solde exact dû par le locataire.',
      'Rapport Financier PDF (Journalier, Mensuel, Annuel) : calcule le Total Appelé, le Total Encaissé, les Honoraires d’Agence et le Net à Reverser par bailleur. Cliquez sur « Imprimer le Rapport PDF » ou « Télécharger PDF ».',
    ],
  },
  {
    number: '07',
    title: 'Paramétrage : Types de Biens, Mois Comptables & Modèles PDF',
    icon: Sliders,
    badgeColor: 'bg-purple-600 text-white',
    cardBorder: 'border-purple-200 bg-purple-50/40',
    items: [
      'Types de Biens Immobiliers : créez de nouveaux types (Duplex, Entrepôt, Boutique...), modifiez leurs charges par défaut ou renommez-les (les biens existants sont mis à jour automatiquement).',
      'Mois Comptables : ouvrez un nouveau mois comptable, définissez le mois actif et générez automatiquement les quittances de tous les baux actifs en un clic.',
      'Modèles de Bail & Quittance PDF : personnalisez les titres, articles, clauses, couleurs et variables dynamiques ({{nom_locataire}}, {{montant_loyer_ttc}}...) globalement ou par bailleur.',
    ],
  },
  {
    number: '08',
    title: 'Mode Hors-Ligne (Offline), Synchro Temps Réel & Application PWA',
    icon: WifiOff,
    badgeColor: 'bg-amber-600 text-white',
    cardBorder: 'border-amber-200 bg-amber-50/40',
    items: [
      'Synchro Temps Réel Active : située sur la même ligne que le menu déroulant des Bailleurs, elle maintient tous vos appareils synchronisés en direct.',
      'Travail Hors-Ligne : en cas de perte de connexion Internet (ou d’activation manuelle du Mode Hors-Ligne), toutes vos créations, modifications et suppressions sont sauvegardées localement et synchronisées dès le retour en ligne.',
      'Application Mobile / PWA : installez Gimmo sur votre écran d’accueil Android, iOS ou PC depuis la rubrique Paramétrage.',
    ],
  },
];

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  onClose,
  isModal = true,
}) => {
  const guidePdfPreviewUrl = '/api/public/user-guide/pdf';
  const guidePdfDownloadUrl = '/api/public/user-guide/pdf?download=1';

  const content = (
    <div className="bg-white border-2 border-indigo-200 rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 px-5 sm:px-6 py-4 sm:py-5 text-white flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 shadow-inner shrink-0">
            <BookOpen className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Guide d&apos;Utilisateur Officiel — Gimmo SaaS
              </h3>
              <span className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-200 rounded-md border border-emerald-400/30">
                3 Pages A4 · Prêt à exporter en PDF
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-200 font-medium mt-0.5">
              Manuel complet d&apos;utilisation du logiciel (Bailleurs, Biens GPS, Baux, Quittances WhatsApp, Recouvrement, Paramétrage & Mode Hors-Ligne)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={guidePdfPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs sm:text-sm font-black transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4 text-emerald-300" />
            <span>Ouvrir & Imprimer le PDF</span>
          </a>

          <a
            href={guidePdfDownloadUrl}
            download="Guide_Utilisateur_Gimmo_SaaS.pdf"
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs sm:text-sm font-black shadow-md transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Exporter / Télécharger en PDF</span>
          </a>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Corps du guide */}
      <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
        {/* Bandeau d'export rapide */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border-2 border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm sm:text-base font-black text-slate-900">
                Document PDF généré nativement en haute définition (Format A4)
              </h4>
              <p className="text-xs sm:text-sm font-medium text-slate-700 mt-0.5">
                Cliquez sur <strong>« Exporter / Télécharger en PDF »</strong> pour enregistrer le fichier{' '}
                <code className="font-mono font-bold text-indigo-800 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                  Guide_Utilisateur_Gimmo_SaaS.pdf
                </code>{' '}
                sur votre téléphone ou votre ordinateur, ou sur <strong>« Ouvrir & Imprimer le PDF »</strong> pour l&apos;afficher dans un nouvel onglet.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={guidePdfDownloadUrl}
              download="Guide_Utilisateur_Gimmo_SaaS.pdf"
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black shadow-sm transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger le PDF maintenant</span>
            </a>
          </div>
        </div>

        {/* Grille des 8 Chapitres du Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GUIDE_CHAPTERS.map((chapter) => {
            const IconComponent = chapter.icon;
            return (
              <div
                key={chapter.number}
                className={`p-4 sm:p-5 rounded-2xl border-2 ${chapter.cardBorder} flex flex-col justify-between gap-3`}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${chapter.badgeColor}`}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                      Chapitre {chapter.number}
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                      {chapter.title}
                    </h4>
                  </div>

                  <ul className="space-y-2 text-xs sm:text-sm text-slate-800 font-medium">
                    {chapter.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-600 font-black mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pied de modale */}
      {isModal && onClose && (
        <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t-2 border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-xs sm:text-sm font-bold text-slate-600">
            Gimmo SaaS — Documentation Utilisateur & Comptable
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={guidePdfPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-indigo-800 border-2 border-indigo-200 text-xs sm:text-sm font-black transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Ouvrir & Imprimer le PDF</span>
            </a>
            <a
              href={guidePdfDownloadUrl}
              download="Guide_Utilisateur_Gimmo_SaaS.pdf"
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exporter en PDF</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs sm:text-sm font-black transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-6xl my-auto max-h-[92dvh] flex flex-col rounded-2xl overflow-hidden">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
