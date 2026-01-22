'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useTransition } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const pathname = usePathname();
    const t = useTranslations('LanguageSwitcher');

    function onSelectChange(value: string) {
        const nextLocale = value;
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    }

    return (
        <Select value={locale} onValueChange={onSelectChange} disabled={isPending}>
            <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('language')} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="en">{t('english')}</SelectItem>
                <SelectItem value="mn">{t('mongolian')}</SelectItem>
            </SelectContent>
        </Select>
    );
}
