package com.hmall.common.utils;

import java.util.Collection;
import java.util.Iterator;

public final class CollUtils {

    private CollUtils() {
    }

    public static boolean isEmpty(Collection<?> coll) {
        return coll == null || coll.isEmpty();
    }

    public static String join(Collection<?> coll, String separator) {
        if (isEmpty(coll)) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        Iterator<?> it = coll.iterator();
        while (it.hasNext()) {
            sb.append(it.next());
            if (it.hasNext()) {
                sb.append(separator);
            }
        }
        return sb.toString();
    }
}
