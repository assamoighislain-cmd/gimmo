import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Briefcase,
  LogIn,
  LogOut,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
  Save,
  RotateCcw,
  Mail,
  User as UserIcon,
  KeyRound,
} from 'lucide-react';
import type { AppUser, UserRole } from '../types/gimmo.ts';
import { ROLE_DEFINITIONS } from '../lib/rbac.ts';

interface UsersRolesPanelProps {
  users: AppUser[];
  activeRole: UserRole;
  activeUserName: string;
  activeUserEmail: string;
  isGoogleAuthenticated: boolean;
  onSelectRoleAndUser: (role: UserRole, user?: AppUser) => void;
  onGoogleLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  onUpsertUser: (payload: {
    id?: number;
    name: string;
    email: string;
    role: UserRole;
    descriptionLog: string;
  }) => Promise<void>;
  onDeleteUser?: (userId: number, userName: string) => Promise<void>;
  isModal?: boolean;
  onCloseModal?: () => void;
}

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  administrateur: <ShieldCheck className="w-5 h-5" />,
  gerant: <UserCheck className="w-5 h-5" />,
  commercial: <Briefcase className="w-5 h-5" />,
};

export const UsersRolesPanel: React.FC<UsersRolesPanelProps> = ({
  users,
  activeRole,
  activeUserName,
  activeUserEmail,
  isGoogleAuthenticated,
  onSelectRoleAndUser,
  onGoogleLogin,
  onLogout,
  onUpsertUser,
  onDeleteUser,
  isModal = false,
  onCloseModal,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('gerant');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const canManageAccounts =
    ROLE_DEFINITIONS[activeRole].permissions.canManageUsers;

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setRole('gerant');
    setErrorMsg(null);
  };

  const handleStartEdit = (u: AppUser) => {
    setEditingId(u.id);
    setName(u.name || '');
    setEmail(u.email);
    setRole(u.role);
    setErrorMsg(null);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setErrorMsg('Veuillez renseigner le nom complet et l’adresse email.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const isEdit = editingId !== null;
      const roleLabel = ROLE_DEFINITIONS[role].label;
      await onUpsertUser({
        id: editingId ?? undefined,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        descriptionLog: isEdit
          ? `Modification du compte ${name.trim()} (${roleLabel})`
          : `Création du compte ${name.trim()} (${roleLabel})`,
      });
      setFeedback(
        isEdit
          ? `Compte "${name.trim()}" mis à jour avec le rôle ${roleLabel}.`
          : `Nouveau compte "${name.trim()}" créé avec le rôle ${roleLabel}.`
      );
      resetForm();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to save user:', err);
      setErrorMsg("Erreur lors de l'enregistrement du compte utilisateur.");
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-md overflow-hidden">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 px-5 py-4 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 shadow-inner">
            <KeyRound className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-black tracking-tight">
                Gestion de la Connexion & des Rôles
              </h3>
              <span
                className={`px-2.5 py-0.5 text-xs font-black uppercase tracking-wider rounded-md border ${ROLE_DEFINITIONS[activeRole].headerBadgeClass}`}
              >
                Session active : {ROLE_DEFINITIONS[activeRole].label}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-100 font-medium mt-0.5">
              Connectez-vous et basculez entre les 3 profils d’accès : Administrateur, Gérant et Commercial.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isGoogleAuthenticated ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-black transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Déconnexion Google</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoogleLogin}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-black transition-colors cursor-pointer shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Connexion Google (SSO)</span>
            </button>
          )}

          {isModal && onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Bandeau de session active */}
        <div className="p-4 rounded-2xl bg-indigo-50/80 border-2 border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0">
              {ROLE_ICONS[activeRole]}
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                Utilisateur connecté actuellement
              </div>
              <div className="text-sm sm:text-base font-black text-slate-950">
                {activeUserName}{' '}
                <span className="text-xs font-mono font-semibold text-slate-600">
                  ({activeUserEmail})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">
              Rôle appliqué :
            </span>
            <span
              className={`px-3 py-1 rounded-xl text-xs font-black border ${ROLE_DEFINITIONS[activeRole].badgeClass}`}
            >
              {ROLE_DEFINITIONS[activeRole].label}
            </span>
          </div>
        </div>

        {/* Cartes des 3 Rôles : Administrateur, Gérant, Commercial */}
        <div>
          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700 mb-3">
            1. Choisir un Rôle de Connexion (Administrateur, Gérant ou Commercial)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['administrateur', 'gerant', 'commercial'] as UserRole[]).map(
              (rKey) => {
                const def = ROLE_DEFINITIONS[rKey];
                const isSelected = activeRole === rKey;
                const matchingUser = users.find((u) => u.role === rKey);

                return (
                  <div
                    key={rKey}
                    className={`p-4 rounded-2xl border-2 flex flex-col justify-between gap-4 transition-all ${
                      isSelected
                        ? 'bg-indigo-950 text-white border-indigo-600 shadow-lg ring-2 ring-indigo-400/50'
                        : 'bg-slate-50 text-slate-900 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-2 rounded-xl ${
                              isSelected
                                ? 'bg-white/15 text-amber-300'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {ROLE_ICONS[rKey]}
                          </span>
                          <span className="text-base font-black">
                            {def.label}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-500 text-slate-950 text-[11px] font-black uppercase">
                            Actif
                          </span>
                        )}
                      </div>

                      <p
                        className={`text-xs leading-relaxed font-medium ${
                          isSelected ? 'text-indigo-100' : 'text-slate-600'
                        }`}
                      >
                        {def.description}
                      </p>

                      <ul className="space-y-1 pt-1">
                        {def.permissionsSummary.map((line, idx) => (
                          <li
                            key={idx}
                            className={`text-[11px] flex items-start gap-1.5 font-semibold ${
                              isSelected ? 'text-indigo-200' : 'text-slate-700'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                isSelected
                                  ? 'text-emerald-400'
                                  : 'text-emerald-600'
                              }`}
                            />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectRoleAndUser(rKey, matchingUser);
                        setFeedback(
                          `Session basculée sur le rôle « ${def.label} »${
                            matchingUser ? ` (${matchingUser.name})` : ''
                          }.`
                        );
                        setTimeout(() => setFeedback(null), 3500);
                      }}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                      }`}
                    >
                      {isSelected
                        ? `Connecté en tant que ${def.label}`
                        : `Se connecter en ${def.label}`}
                    </button>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Formulaire de Création / Modification d'un Compte Collaborateur */}
        {canManageAccounts ? (
          <form
            onSubmit={handleSubmit}
            className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
              editingId !== null
                ? 'bg-amber-50/70 border-amber-400 shadow-sm'
                : 'bg-slate-50 border-indigo-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                {editingId !== null ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 text-white text-xs font-black uppercase tracking-wider shadow-sm">
                    <Edit3 className="w-3.5 h-3.5" />
                    Modifier le Collaborateur #{editingId}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-sm">
                    <Plus className="w-3.5 h-3.5" />
                    2. Ajouter ou Modifier un Compte Collaborateur (Administrateur, Gérant, Commercial)
                  </span>
                )}
              </div>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-black transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Annuler l&apos;édition
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs sm:text-sm font-bold flex items-center justify-between">
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-600 hover:text-rose-900 font-black ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {feedback && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-800 text-xs sm:text-sm font-black flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{feedback}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Nom & Fonction du Collaborateur *
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Koné Franck — Commercial"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Email de Connexion *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="collaborateur@gimmo.ci"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Rôle attribué *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-black text-indigo-950 focus:outline-none focus:border-indigo-600"
                >
                  <option value="administrateur">Administrateur (Accès complet)</option>
                  <option value="gerant">Gérant (Gestion locative & comptable)</option>
                  <option value="commercial">Commercial (Biens GPS & Baux)</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2.5">
              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-black"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer disabled:opacity-50 ${
                  editingId !== null
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700'
                }`}
              >
                {editingId !== null ? (
                  <>
                    <Save className="w-4 h-4" />
                    {submitting ? 'Enregistrement...' : 'Enregistrer le Rôle'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {submitting ? 'Création...' : 'Créer ce Compte & Rôle'}
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-amber-950 text-xs sm:text-sm font-bold flex items-center justify-between gap-3">
            <span>
              Vous êtes actuellement connecté avec le rôle{' '}
              <strong>{ROLE_DEFINITIONS[activeRole].label}</strong>. La création ou suppression de comptes collaborateurs est réservée au rôle <strong>Administrateur</strong>.
            </span>
            <button
              type="button"
              onClick={() => onSelectRoleAndUser('administrateur')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Passer en Administrateur
            </button>
          </div>
        )}

        {/* Tableau des Comptes Utilisateurs & Rôles */}
        <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-black uppercase tracking-wider">
                  <th className="py-3.5 px-4">Collaborateur / Compte</th>
                  <th className="py-3.5 px-4">Email de Connexion</th>
                  <th className="py-3.5 px-4">Rôle Attribué</th>
                  <th className="py-3.5 px-4 text-right">
                    Actions (Connexion / Modifier / Supprimer)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {users.map((u) => {
                  const roleDef = ROLE_DEFINITIONS[u.role];
                  const isCurrentSession =
                    u.email.toLowerCase() === activeUserEmail.toLowerCase() &&
                    u.role === activeRole;

                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors ${
                        isCurrentSession
                          ? 'bg-emerald-50/70'
                          : 'hover:bg-indigo-50/40'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm sm:text-base">
                            {u.name || u.email.split('@')[0]}
                          </span>
                          {isCurrentSession && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-black uppercase">
                              Connecté
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs sm:text-sm font-bold text-indigo-800">
                        {u.email}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${roleDef.badgeClass}`}
                        >
                          {ROLE_ICONS[u.role]}
                          <span>{roleDef.label}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectRoleAndUser(u.role, u)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              isCurrentSession
                                ? 'bg-emerald-600 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                            }`}
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>
                              {isCurrentSession ? 'Session active' : 'Se connecter'}
                            </span>
                          </button>

                          {canManageAccounts && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(u)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Modifier</span>
                              </button>

                              {onDeleteUser && users.length > 1 && (
                                <>
                                  {confirmDeleteId === u.id ? (
                                    <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 rounded-xl px-2 py-1">
                                      <button
                                        type="button"
                                        disabled={deletingId === u.id}
                                        onClick={async () => {
                                          setDeletingId(u.id);
                                          try {
                                            await onDeleteUser(
                                              u.id,
                                              u.name || u.email
                                            );
                                            if (editingId === u.id) {
                                              resetForm();
                                            }
                                          } finally {
                                            setDeletingId(null);
                                            setConfirmDeleteId(null);
                                          }
                                        }}
                                        className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
                                      >
                                        {deletingId === u.id
                                          ? '...'
                                          : 'Confirmer ?'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer"
                                      >
                                        Annuler
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(u.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Supprimer</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-6xl my-auto max-h-[92dvh] overflow-y-auto rounded-2xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
