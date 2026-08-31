import type { ReactNode } from "react";

import { MealSubTypesSection } from "@/components/settings/MealSubTypesSection";
import { MealTypesSection } from "@/components/settings/MealTypesSection";

import { CategorySettingsPanel } from "./CategorySettingsPanel";

type MealPlansSettingsProps = {
	active: boolean;
	ariaLabelledBy: string;
	description: string;
	id: string;
	children?: ReactNode;
};

export function MealPlansSettings({
	active,
	ariaLabelledBy,
	description,
	id,
}: MealPlansSettingsProps) {
	return (
		<CategorySettingsPanel
			active={active}
			ariaLabelledBy={ariaLabelledBy}
			description={description}
			id={id}
		>
			<MealTypesSection />
			<MealSubTypesSection />
		</CategorySettingsPanel>
	);
}