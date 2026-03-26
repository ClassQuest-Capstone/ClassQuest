export type EquipSlot = "helmet" | "armour" | "hand_item" | "pet" | "background";

export type EquippedItems = {
    equipped_id: string;
    class_id: string;
    student_id: string;
    avatar_base_id: string;
    helmet_item_id?: string;
    armour_item_id?: string;
    hand_item_id?: string;
    pet_item_id?: string;
    background_item_id?: string;
    equipped_at: string;
    updated_at: string;
};

export type CreateEquippedItemsInput = {
    class_id: string;
    student_id: string;
    avatar_base_id: string;
};

export type UpdateEquippedItemsInput = Partial<{
    avatar_base_id: string;
    helmet_item_id: string;
    armour_item_id: string;
    hand_item_id: string;
    pet_item_id: string;
    background_item_id: string;
}>;

export type EquipSlotInput = {
    slot: EquipSlot;
    item_id: string;
};

export type UnequipSlotInput = {
    slot: EquipSlot;
};

export type PaginatedEquippedItems = {
    items: EquippedItems[];
    cursor?: string | null;
};
