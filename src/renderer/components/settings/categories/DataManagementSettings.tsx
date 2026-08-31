import { DataManagementSection } from "@/components/settings/DataManagementSection";

import { CategorySettingsPanel } from "./CategorySettingsPanel";

type DataManagementSettingsProps = {
	active: boolean;
	ariaLabelledBy: string;
	description: string;
	id: string;
	onPreferencesRestored: () => void;
	onResetPreferences: () => Promise<void>;
	resettingPreferences: boolean;
};

export function DataManagementSettings({
	active,
	ariaLabelledBy,
	description,
	id,
	onPreferencesRestored,
	onResetPreferences,
	resettingPreferences,
}: DataManagementSettingsProps) {
	return (
		<CategorySettingsPanel
			active={active}
			ariaLabelledBy={ariaLabelledBy}
			description={description}
			id={id}
		>
			<DataManagementSection
				onPreferencesRestored={onPreferencesRestored}
				onResetPreferences={onResetPreferences}
				resettingPreferences={resettingPreferences}
			/>
		</CategorySettingsPanel>
	);
}