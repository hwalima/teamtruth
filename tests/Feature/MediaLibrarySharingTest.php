<?php

use App\Models\MediaFolder;
use App\Models\MediaItem;
use App\Models\User;
use App\Models\Workspace;
use App\Modules\Core\Models\Company;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->owner = User::factory()->create(['type' => 'company', 'name' => 'Olive Owner']);
    $this->workspace = Workspace::create(['name' => 'Sample Mining Projects', 'slug' => 'sample-mining-projects', 'owner_id' => $this->owner->id]);
    $this->member = User::factory()->create(['type' => 'user', 'name' => 'Alex Sample']);

    foreach ([[$this->owner, 'owner'], [$this->member, 'member']] as [$user, $role]) {
        DB::table('workspace_members')->insert([
            'workspace_id' => $this->workspace->id, 'user_id' => $user->id, 'role' => $role,
            'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $user->forceFill(['current_workspace_id' => $this->workspace->id])->save();
    }
});

function libraryFile(User $uploader, int $workspaceId, array $extra = []): MediaItem
{
    $item = MediaItem::create(['name' => 'Site plan', 'workspace_id' => $workspaceId, 'user_id' => $uploader->id] + $extra);
    $media = $item->addMedia(UploadedFile::fake()->create('site-plan.pdf', 12, 'application/pdf'))
        ->toMediaCollection('images', 'public');
    $media->forceFill(['user_id' => $uploader->id])->save();

    return $item;
}

test('everyone in the workspace sees the files and folders others uploaded', function () {
    libraryFile($this->owner, $this->workspace->id);
    MediaFolder::create(['name' => 'Contracts', 'workspace_id' => $this->workspace->id, 'user_id' => $this->owner->id]);

    $this->actingAs($this->member)->getJson(route('api.media.index'))
        ->assertOk()->assertJsonCount(1)->assertJsonPath('0.name', 'site-plan');
    $this->actingAs($this->member)->getJson(route('api.media.folders.index'))
        ->assertOk()->assertJsonPath('0.name', 'Contracts');
});

test('the library stays the same whichever ERP company is open', function () {
    libraryFile($this->member, $this->workspace->id);
    $company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining', 'default_currency' => 'USD']);

    $this->actingAs($this->member)->withSession(['active_erp_company_id' => $company->id])
        ->getJson(route('api.media.index'))->assertOk()->assertJsonCount(1);
});

test('files from another workspace I belong to still show after switching workspace', function () {
    $other = Workspace::create(['name' => 'Acme Projects', 'slug' => 'acme-projects', 'owner_id' => $this->member->id]);
    libraryFile($this->member, $other->id);
    libraryFile($this->owner, $this->workspace->id);

    $this->actingAs($this->member)->getJson(route('api.media.index'))->assertOk()->assertJsonCount(2);
});

test('people outside the workspace see nothing', function () {
    libraryFile($this->owner, $this->workspace->id);

    $this->actingAs(User::factory()->create(['type' => 'user']))
        ->getJson(route('api.media.index'))->assertOk()->assertJsonCount(0);
});

test('locked files stay hidden from members without access', function () {
    libraryFile($this->owner, $this->workspace->id, ['is_locked' => true]);
    $folder = MediaFolder::create(['name' => 'Payroll', 'workspace_id' => $this->workspace->id, 'user_id' => $this->owner->id, 'is_locked' => true]);
    libraryFile($this->owner, $this->workspace->id, ['folder_id' => $folder->id]);

    $this->actingAs($this->member)->getJson(route('api.media.index'))->assertOk()->assertJsonCount(0);
    $this->actingAs($this->owner)->getJson(route('api.media.index'))->assertOk()->assertJsonCount(2);
});

test('only the uploader or the owner can change someone else\'s file or folder', function () {
    $item = libraryFile($this->owner, $this->workspace->id);
    $folder = MediaFolder::create(['name' => 'Contracts', 'workspace_id' => $this->workspace->id, 'user_id' => $this->owner->id]);

    $this->actingAs($this->member)->postJson(route('api.media.toggleLock', $item->id))->assertForbidden();
    $this->actingAs($this->member)->putJson(route('api.media.folders.update', $folder->id), ['name' => 'Mine'])->assertForbidden();

    $own = libraryFile($this->member, $this->workspace->id);
    $this->actingAs($this->member)->postJson(route('api.media.toggleLock', $own->id))->assertOk();
    $this->actingAs($this->owner)->putJson(route('api.media.folders.update', $folder->id), ['name' => 'Signed contracts'])->assertOk();
});
