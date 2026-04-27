/**
 * EXPLORER UPLOADS — image upload pipeline + drop-zone state.
 *
 * Owns the reactive `uploading` queue and `dragOver` flag so the panel doesn't
 * have to. The R2 presign → PUT → confirm flow lives here unchanged from when
 * it was inlined in `ExplorerPanel.svelte`. The panel passes an `ActionContext`
 * for refresh + error reporting (same pattern as `dispatchMove`).
 */
import { apiFetch } from '$lib/api';
import type { ActionContext } from './explorer-actions';
import type { UploadingItem } from './types';

export class ExplorerUploads {
	uploading = $state<UploadingItem[]>([]);
	dragOver = $state<boolean>(false);

	async uploadFiles(files: FileList | File[], ctx: ActionContext): Promise<void> {
		for (const file of files) {
			if (!file.type.startsWith('image/')) {
				ctx.setError(`"${file.name}" is not an image file.`);
				continue;
			}

			const uploadId = crypto.randomUUID();
			this.uploading = [...this.uploading, { id: uploadId, fileName: file.name, status: 'uploading' }];

			try {
				const urlRes = await apiFetch('/api/blog/assets', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size }),
				});
				if (!urlRes.ok) {
					const data = await urlRes.json().catch(() => ({}));
					throw new Error((data as { message?: string }).message || 'Failed to get upload URL');
				}
				const { upload } = (await urlRes.json()) as { upload: { url: string; key: string } };

				const putRes = await fetch(upload.url, {
					method: 'PUT',
					body: file,
					headers: { 'Content-Type': file.type },
				});
				if (!putRes.ok) throw new Error('Upload to storage failed');

				let width: number | undefined;
				let height: number | undefined;
				try {
					const bitmap = await createImageBitmap(file);
					width = bitmap.width;
					height = bitmap.height;
					bitmap.close();
				} catch {
					/* Non-image or unsupported format */
				}

				const confirmRes = await apiFetch('/api/blog/assets/confirm', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						key: upload.key,
						fileName: file.name,
						mimeType: file.type,
						fileSize: file.size,
						width,
						height,
					}),
				});
				if (!confirmRes.ok) throw new Error('Failed to confirm upload');

				this.uploading = this.uploading.filter((u) => u.id !== uploadId);
				await ctx.refresh();
			} catch (e) {
				this.uploading = this.uploading.map((u) =>
					u.id === uploadId
						? { ...u, status: 'error' as const, error: e instanceof Error ? e.message : 'Upload failed' }
						: u,
				);
			}
		}
	}

	onDragOver(e: DragEvent): void {
		if (e.dataTransfer?.types.includes('Files')) {
			e.preventDefault();
			this.dragOver = true;
		}
	}

	onDragLeave(): void {
		this.dragOver = false;
	}

	onDrop(e: DragEvent, ctx: ActionContext): void {
		e.preventDefault();
		this.dragOver = false;
		if (e.dataTransfer?.files.length) void this.uploadFiles(e.dataTransfer.files, ctx);
	}
}
