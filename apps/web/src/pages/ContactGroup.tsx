import { Users, Search, ArrowUpDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import ConversationListItem from '@/components/layout/ConversationListItem'
import { fetchConversations } from '@/store/slices/conversationSlice'

const ContactGroup = () => {
  // Subcomponent defined in-file: GroupList
  const GroupList: React.FC = () => {
    const dispatch = useAppDispatch();
    const conversations = useAppSelector((s) => s.conversation.conversations);
    const isLoading = useAppSelector((s) => s.conversation.isLoading);
    const error = useAppSelector((s) => s.conversation.error);

    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [search, setSearch] = useState<string>('');
    const [debouncedSearch, setDebouncedSearch] = useState<string>('');
    const [sortOption, setSortOption] = useState<'activity_desc' | 'activity_asc' | 'az' | 'za'>('activity_desc');

    useEffect(() => {
      dispatch(fetchConversations());
    }, [dispatch]);

    const sorted = useMemo(() => {
      return [...conversations].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    }, [conversations]);

    useEffect(() => {
      const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
      return () => clearTimeout(id);
    }, [search]);

    const visible = useMemo(() => {
      // Start from sorted (pinned + recent message)
      let list = sorted.filter((c) => (c.type === 'GROUP' || !!c.group) && !c.hidden);

      // filter unread if needed
      if (activeTab === 'unread') {
        list = list.filter((c) => (c.unreadCount || 0) > 0);
      }

      // filter by category
      if (selectedCategory !== 'all') {
        list = list.filter((c) => c.category === selectedCategory);
      }

      // filter by search (partial, case-insensitive)
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        list = list.filter((c) => (c.name || '').toLowerCase().includes(q));
      }

      // apply sorting
      switch (sortOption) {
        case 'activity_desc':
          list = list.sort((a, b) => {
            const aTime = new Date(a.createdAt || a.lastMessageAt || 0).getTime();
            const bTime = new Date(b.createdAt || b.lastMessageAt || 0).getTime();
            return bTime - aTime;
          });
          break;
        case 'activity_asc':
          list = list.sort((a, b) => {
            const aTime = new Date(a.createdAt || a.lastMessageAt || 0).getTime();
            const bTime = new Date(b.createdAt || b.lastMessageAt || 0).getTime();
            return aTime - bTime;
          });
          break;
        case 'az':
          list = list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
          break;
        case 'za':
          list = list.sort((a, b) => (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' }));
          break;
      }

      return list;
    }, [sorted, activeTab, selectedCategory, debouncedSearch, sortOption]);

    const CATEGORY_OPTIONS = [
      { value: 'all', label: 'Tất cả' },
      { value: 'customer', label: 'Khách hàng', dot: 'bg-red-500' },
      { value: 'family', label: 'Gia đình', dot: 'bg-green-500' },
      { value: 'work', label: 'Công việc', dot: 'bg-orange-500' },
      { value: 'friends', label: 'Bạn bè', dot: 'bg-purple-500' },
      { value: 'later', label: 'Trả lời sau', dot: 'bg-yellow-500' },
      { value: 'colleague', label: 'Đồng nghiệp', dot: 'bg-blue-500' },
    ];

    const CategoryDropdown: React.FC = () => {
      const [open, setOpen] = useState(false);
      const ref = useRef<HTMLDivElement | null>(null);

      useEffect(() => {
        const onDoc = (e: MouseEvent) => {
          if (!ref.current) return;
          if (!ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('click', onDoc);
        return () => document.removeEventListener('click', onDoc);
      }, []);

      const current = CATEGORY_OPTIONS.find((o) => o.value === selectedCategory) || CATEGORY_OPTIONS[0];

      return (
        <div ref={ref} className="relative w-full">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="flex w-full items-center justify-between gap-2 text-sm"
          >
            <div className="flex items-center gap-2">
              {current.value !== 'all' && (
                <span className={`h-2 w-2 rounded-full ${current.dot}`} />
              )}
              <span className="text-sm text-gray-700">{current.label}</span>
            </div>
            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="none">
              <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 left-0 mt-2 z-40 w-full rounded-md border bg-white shadow-md">
              {CATEGORY_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedCategory(opt.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer px-3 py-2 hover:bg-gray-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {opt.value !== 'all' && <span className={`h-2 w-2 rounded-full ${opt.dot}`} />}
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </div>
                  {selectedCategory === opt.value && <span className="text-blue-500">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    // Hide specific menu items when opening the floating menu from this page.
    // We don't change ConversationListItem — instead we remove those nodes
    // from the floating portal DOM when an item is opened here.
    useEffect(() => {
      if (!openMenu) return;

      const raf = requestAnimationFrame(() => {
        try {
          const menus = Array.from(document.querySelectorAll('[class*="z-50"]')) as HTMLElement[];
          menus.forEach((menu) => {
            Array.from(menu.querySelectorAll('div')).forEach((node) => {
              const txt = (node.textContent || '').trim();
              if (!txt) return;
              if (txt.includes('Tắt thông báo') || txt.includes('Tin nhắn tự')) {
                (node as HTMLElement).style.display = 'none';
              }
            });
          });
        } catch (e) {
          // ignore DOM errors
        }
      });

      return () => cancelAnimationFrame(raf);
    }, [openMenu]);

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center border-b border-[#e5e7eb] px-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-600" />
            <h1 className="text-[16px] font-semibold text-gray-800">Danh sách nhóm và cộng đồng</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2 py-1 text-sm ${activeTab === 'all' ? 'font-semibold text-[#0068ff]' : 'text-gray-600'}`}>
              Tất cả
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-2 py-1 text-sm ${activeTab === 'unread' ? 'font-semibold text-[#0068ff]' : 'text-gray-600'}`}>
              Chưa đọc
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col bg-gray-200 px-5 pt-5">
          <div className="mb-3">
            <h2 className="text-sm text-gray-600">Nhóm và cộng đồng ({visible.length})</h2>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-md bg-white p-4">
            <div className=" rounded-md p-3 mb-4">
              <div className="flex gap-4 items-center">
                <div className="flex flex-1 items-center rounded-lg bg-white px-3 py-2 border border-[#e5e7eb]">
                  <Search size={18} className="text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="ml-3 w-full outline-none text-sm"
                    placeholder="Tìm kiếm..."
                  />
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 border border-[#e5e7eb]">
                  <ArrowUpDown size={16} />
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as any)}
                    className="appearance-none bg-white outline-none text-sm"
                  >
                    <option value="activity_desc">Hoạt động (mới → cũ)</option>
                    <option value="activity_asc">Hoạt động (cũ → mới)</option>
                    <option value="az">Sắp xếp từ A-Z</option>
                    <option value="za">Sắp xếp từ Z-A</option>
                  </select>
                </div>

                <div className="relative w-56">
                  <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 border border-[#e5e7eb] w-full">
                    {/* Category dropdown (Phân loại theo thẻ) */}
                    <CategoryDropdown />
                  </div>
                </div>
              </div>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-2">
            {isLoading && visible.length === 0 && (
              <div className="py-6 text-center text-sm italic text-gray-400">Đang tải nhóm...</div>
            )}

            {!isLoading && error && <div className="py-6 text-center text-sm text-red-400">{error}</div>}

            {!isLoading && !error && visible.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">Không có nhóm nào</div>
            )}

            {visible.map((conversation: any) => (
              <ConversationListItem
                key={conversation.conversationId}
                conversation={conversation}
                isActive={false}
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
              />
            ))}
          </div>
        </div>
      </div>
      </div>
    );
  };

  return <GroupList />;
}

export default ContactGroup
