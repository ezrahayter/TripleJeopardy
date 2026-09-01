import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** ⋯ menu for a post row / card. Delete works in any state except published. */
export function PostRowMenu({
  postId,
  canEdit = true,
  onDone,
}: {
  postId: string;
  canEdit?: boolean;
  onDone: () => void;
}) {
  const navigate = useNavigate();

  async function del() {
    if (!window.confirm('Delete this post? This removes its draft, schedule and approval record.')) {
      return;
    }
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) toast.error(error.message);
    else {
      toast.success('Post deleted');
      onDone();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Post actions"
        onClick={(e) => e.stopPropagation()}
        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {canEdit && (
          <DropdownMenuItem onSelect={() => navigate(`/compose/${postId}`)}>
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
        )}
        {canEdit && <DropdownMenuSeparator />}
        <DropdownMenuItem
          onSelect={() => void del()}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
