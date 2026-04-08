import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Megaphone, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ImagePicker } from '@/components/ui/image-picker';
import { resolveImageUrl } from '@/lib/images';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { type Ad, type AdCreateInput, type YouBusiness, adsApi, uploadUserImage } from '@/services/api';
import { FieldRow, ModalWrap, SectionTitle, SelectBox } from '../components/ui';

type AdType = 'CARD' | 'BANNER' | 'INTERSTITIAL';

const AD_TYPE_LABEL: Record<AdType, string> = {
  CARD: 'Carte',
  BANNER: 'Banniere',
  INTERSTITIAL: 'Interstitiel',
};

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

export function PublicitesTab({
  ownedBusinesses,
  onReload,
}: {
  ownedBusinesses: YouBusiness[];
  onReload: (refreshBalance?: boolean) => Promise<void>;
}) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [openBusinessPicker, setOpenBusinessPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redirectBusinessId, setRedirectBusinessId] = useState<string>('');
  const [form, setForm] = useState<AdCreateInput>({
    businessId: ownedBusinesses[0]?.id ?? '',
    title: '',
    tagline: '',
    imageUrl: '',
    ctaText: 'En savoir plus',
    ctaLink: '',
    adType: 'CARD',
  });

  const activeAdsCount = useMemo(() => ads.filter((ad) => ad.isActive && ad.status === 'APPROVED').length, [ads]);
  const redirectBusiness = ownedBusinesses.find((b) => b.id === redirectBusinessId) ?? null;

  const loadAds = async () => {
    setLoading(true);
    try {
      const response = await adsApi.listOwn();
      setAds(response.data.ads);
    } catch {
      toast.error('Impossible de charger tes publicites.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAds();
  }, []);

  useEffect(() => {
    if (!form.businessId && ownedBusinesses[0]?.id) {
      setForm((prev) => ({ ...prev, businessId: ownedBusinesses[0]!.id }));
    }
  }, [form.businessId, ownedBusinesses]);

  const uploadAdImage = async (file: File): Promise<string> => {
    const payload = await prepareImageUploadPayload(file);
    const response = await uploadUserImage(payload);
    return response.data.imageUrl;
  };

  const resetForm = () => {
    setRedirectBusinessId('');
    setForm((prev) => ({
      ...prev,
      title: '',
      tagline: '',
      imageUrl: '',
      ctaText: 'En savoir plus',
      ctaLink: '',
    }));
  };

  const createAd = async () => {
    if (!form.businessId || !form.title.trim() || !form.tagline.trim() || !redirectBusinessId) {
      toast.error('Remplis les champs obligatoires.');
      return;
    }

    setSaving(true);
    try {
      await adsApi.create({
        ...form,
        title: form.title.trim(),
        tagline: form.tagline.trim(),
        ctaLink: `/you?tab=explore&business=${redirectBusinessId}`,
        ctaText: form.ctaText?.trim() || 'En savoir plus',
        imageUrl: form.imageUrl?.trim() || null,
      });
      toast.success('Publicite creee');
      setOpenCreate(false);
      resetForm();
      await loadAds();
      await onReload();
    } catch (error: any) {
      const code = error?.response?.data?.error;
      if (code === 'AD_LIMIT_REACHED') {
        toast.error('Limite atteinte: 2 publicites maximum par entreprise.');
      } else if (code === 'AD_TAGLINE_TOO_LONG') {
        toast.error('L accroche est limitee a 100 caracteres.');
      } else {
        toast.error('Impossible de creer la publicite.');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (ad: Ad) => {
    try {
      if (ad.status !== 'APPROVED') {
        toast.error('Cette publicite doit etre approuvee avant activation.');
        return;
      }
      const response = await adsApi.update(ad.id, { isActive: !ad.isActive });
      setAds((prev) => prev.map((entry) => (entry.id === ad.id ? response.data.ad : entry)));
    } catch {
      toast.error('Impossible de modifier cette publicite.');
    }
  };

  const deleteAd = async (adId: string) => {
    try {
      await adsApi.delete(adId);
      setAds((prev) => prev.filter((entry) => entry.id !== adId));
      toast.success('Publicite supprimee');
    } catch {
      toast.error('Suppression impossible.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>{activeAdsCount}/2 publicites actives</SectionTitle>
        <Button type="button" className="gap-2" onClick={() => setOpenCreate(true)} disabled={ownedBusinesses.length === 0}>
          <Plus className="h-4 w-4" />
          Nouvelle publicite
        </Button>
      </div>

      {ownedBusinesses.length === 0 ? <EmptyState text="Tu dois creer une entreprise avant de publier des publicites." /> : null}
      {ownedBusinesses.length > 0 && loading ? <EmptyState text="Chargement des publicites..." /> : null}
      {ownedBusinesses.length > 0 && !loading && ads.length === 0 ? <EmptyState text="Aucune publicite pour le moment." /> : null}

      {ads.map((ad) => (
        <Card key={ad.id}>
          <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold">{ad.title}</p>
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300">{AD_TYPE_LABEL[ad.adType]}</span>
                <span className={ad.status === 'APPROVED' ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300' : ad.status === 'PENDING' ? 'rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300' : 'rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300'}>
                  {ad.status === 'APPROVED' ? 'Approuvee' : ad.status === 'PENDING' ? 'En attente' : 'Refusee'}
                </span>
                {!ad.isActive ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactive</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{ad.tagline}</p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                {ad.business.name} · Impressions: {ad.impressions.toLocaleString('fr-FR')} · Clics: {ad.clicks.toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void toggleActive(ad)} disabled={ad.status !== 'APPROVED'}>
                {ad.isActive ? 'Desactiver' : 'Activer'}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-400" onClick={() => void deleteAd(ad.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <ModalWrap
        open={openCreate}
        onClose={() => { setOpenCreate(false); resetForm(); }}
        title={<span className="inline-flex items-center gap-2"><Megaphone className="h-4 w-4" />Creer une publicite</span>}
        desc="Les publicites sont visibles dans la grille des jeux, la page You et avant certains lancements de jeu."
      >
        <FieldRow label="Entreprise">
          <SelectBox value={form.businessId} onChange={(value) => setForm((prev) => ({ ...prev, businessId: value }))}>
            {ownedBusinesses.map((business) => (
              <option key={business.id} value={business.id}>{business.name}</option>
            ))}
          </SelectBox>
        </FieldRow>

        <FieldRow label="Type de publicite">
          <SelectBox value={form.adType} onChange={(value) => setForm((prev) => ({ ...prev, adType: value as AdType }))}>
            <option value="CARD">Carte</option>
            <option value="BANNER">Banniere</option>
            <option value="INTERSTITIAL">Interstitiel</option>
          </SelectBox>
        </FieldRow>

        <FieldRow label="Titre">
          <Input
            maxLength={80}
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Titre de la pub"
          />
        </FieldRow>

        <FieldRow label={`Accroche (${form.tagline.length}/100)`}>
          <Input
            maxLength={100}
            value={form.tagline}
            onChange={(event) => setForm((prev) => ({ ...prev, tagline: event.target.value }))}
            placeholder="Ton accroche"
          />
        </FieldRow>

        <FieldRow label="Image (optionnel)">
          <ImagePicker
            value={form.imageUrl ?? ''}
            onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
            uploadFn={uploadAdImage}
          />
        </FieldRow>

        <FieldRow label="Texte du bouton">
          <Input
            value={form.ctaText ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, ctaText: event.target.value }))}
            placeholder="En savoir plus"
          />
        </FieldRow>

        <FieldRow label="Redirection vers *">
          {redirectBusiness ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
              {redirectBusiness.logoUrl ? (
                <img src={resolveImageUrl(redirectBusiness.logoUrl)} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              <span className="flex-1 truncate text-sm font-medium">{redirectBusiness.name}</span>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpenBusinessPicker(true)}>
                Changer
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setOpenBusinessPicker(true)}>
              <Building2 className="h-4 w-4" />
              Choisir un business
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Cliquer sur la pub ouvrira la fiche de ce business dans l&apos;Explore.</p>
        </FieldRow>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => { setOpenCreate(false); resetForm(); }}>Annuler</Button>
          <Button type="button" onClick={() => void createAd()} disabled={saving}>{saving ? 'Creation...' : 'Creer'}</Button>
        </div>
      </ModalWrap>

      <ModalWrap
        open={openBusinessPicker}
        onClose={() => setOpenBusinessPicker(false)}
        title="Choisir un business"
        desc="La publicite redirigera les joueurs vers ce business dans l'Explore."
      >
        <div className="space-y-2">
          {ownedBusinesses.map((business) => (
            <button
              key={business.id}
              type="button"
              onClick={() => { setRedirectBusinessId(business.id); setOpenBusinessPicker(false); }}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/20 ${redirectBusinessId === business.id ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              {business.logoUrl ? (
                <img src={resolveImageUrl(business.logoUrl)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{business.name}</p>
                <p className="truncate text-xs text-muted-foreground">{business.type?.label ?? business.typeKey}</p>
              </div>
              {redirectBusinessId === business.id ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
            </button>
          ))}
        </div>
      </ModalWrap>
    </div>
  );
}
